// Supabase CLI's explicit HostIp overrides the Docker network binding default.
// Keep this correction scoped to the two verified disposable containers only.
const http = require('node:http');
const socketPath = '\\\\.\\pipe\\docker_engine';
function request(method, route, body) {
  return new Promise((resolve, reject) => {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ socketPath, path: '/v1.52' + route, method,
      headers: raw ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw) } : {} }, res => {
      let text = ''; res.on('data', chunk => { text += chunk; });
      res.on('end', () => res.statusCode >= 400
        ? reject(new Error(`Docker API ${res.statusCode}: ${method} ${route}`))
        : resolve(text ? JSON.parse(text) : null));
    });
    req.on('error', reject); if (raw) req.write(raw); req.end();
  });
}
(async () => {
  const snapshots = [];
  for (const name of ['supabase_db_supabase-disposable', 'supabase_kong_supabase-disposable']) {
    const data = await request('GET', '/containers/' + name + '/json');
    const labels = data.Config.Labels;
    if (labels['com.supabase.cli.project'] !== 'supabase-disposable' ||
        labels['com.supabase.cli.workdir'] !== 'C:\\Users\\u1434\\AppData\\Local\\OvonaTools\\supabase-disposable') {
      throw new Error('Disposable project identity mismatch; no containers changed.');
    }
    snapshots.push({ name, data });
  }
  for (const { name, data } of snapshots) {
    const bindings = Object.values(data.HostConfig.PortBindings ?? {}).flat();
    if (bindings.length && bindings.every(binding => binding.HostIp === '127.0.0.1')) continue;
    if (name.includes('_kong_')) {
      // CLI copies gateway certificates/configuration into the writable layer.
      // Preserve that layer locally before recreating its port configuration.
      const image = await request('POST', '/commit?container=' + data.Id + '&repo=ovona-baseline-kong&tag=localhost&pause=true');
      data.Config.Image = image.Id;
    }
    bindings.forEach(binding => { binding.HostIp = '127.0.0.1'; });
    const endpoints = Object.fromEntries(Object.entries(data.NetworkSettings.Networks)
      .map(([network, settings]) => [network, { Aliases: settings.Aliases, DriverOpts: settings.DriverOpts }]));
    await request('POST', '/containers/' + data.Id + '/stop?t=10');
    await request('DELETE', '/containers/' + data.Id + '?v=false');
    const created = await request('POST', '/containers/create?name=' + encodeURIComponent(name),
      { ...data.Config, HostConfig: data.HostConfig, NetworkingConfig: { EndpointsConfig: endpoints } });
    await request('POST', '/containers/' + created.Id + '/start');
    console.log(name + ': localhost-only binding; named volumes retained.');
  }
  // Recreating PostgreSQL invalidates pooled connections even when its health
  // check is green. Refresh only this project's dependent service pools.
  for (const name of ['supabase_auth_supabase-disposable', 'supabase_rest_supabase-disposable']) {
    const data = await request('GET', '/containers/' + name + '/json');
    if (data.Config.Labels['com.supabase.cli.project'] !== 'supabase-disposable') {
      throw new Error('Dependent service identity mismatch.');
    }
    await request('POST', '/containers/' + data.Id + '/restart?t=10');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
