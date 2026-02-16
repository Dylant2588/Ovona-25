"use client";

import { ReactNode } from "react";
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from "@mui/material";
import { AuthProvider } from "@/lib/auth-context";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7dd3fc" },
    secondary: { main: "#fbbf24" },
    background: {
      default: "#05070f",
      paper: "#0c1020",
    },
    text: {
      primary: "#f6f7fb",
      secondary: "rgba(246, 247, 251, 0.72)",
    },
  },
  shape: { borderRadius: 18 },
  typography: {
    fontFamily: "var(--font-inter, 'Inter', 'Roboto', sans-serif)",
    fontWeightRegular: 400,
    fontWeightMedium: 600,
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(125, 211, 252, 0.08), transparent 35%), radial-gradient(circle at 80% 0%, rgba(251, 191, 36, 0.08), transparent 30%)",
          }}
        >
          <AppBar
            position="sticky"
            color="transparent"
            elevation={0}
            sx={{
              borderBottom: "1px solid",
              borderColor: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(12px)",
              backgroundColor: "rgba(5, 7, 15, 0.8)",
            }}
          >
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
                Ovona
              </Typography>
            </Toolbar>
          </AppBar>
          <Container component="main" sx={{ py: { xs: 4, md: 6 } }}>
            {children}
          </Container>
        </Box>
      </AuthProvider>
    </ThemeProvider>
  );
}
