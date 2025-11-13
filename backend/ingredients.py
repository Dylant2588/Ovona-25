import re
from collections import defaultdict

# List of pantry staples to exclude from shopping list and pricing
STAPLES = [
    "salt", "pepper", "oil", "olive oil", "vegetable oil", "butter", "garlic",
    "honey", "mustard", "soy sauce", "vinegar", "mayonnaise", "sugar", "spices",
    "herbs", "ketchup", "flour", "baking powder", "seasoning", "chilli flakes",
    "coconut milk", "lemon juice", "maple syrup"
]

def is_staple(ingredient: str) -> bool:
    return any(staple in ingredient.lower() for staple in STAPLES)

def parse_ingredient(raw_ingredient: str):
    """
    Extract the name and quantity from a raw ingredient string.
    E.g., "Chicken Breast – 200g" -> ("chicken breast", "200g")
    """
    parts = re.split(r"–|-", raw_ingredient)
    if len(parts) == 2:
        name, quantity = parts[0].strip().lower(), parts[1].strip()
    else:
        name, quantity = raw_ingredient.strip().lower(), "1 unit"
    return name, quantity

def extract_ingredients(raw_ingredients: list[str]) -> dict:
    """
    Cleans and groups ingredients, ignoring pantry staples.
    Returns a dict of ingredient name → total quantity list.
    """
    grouped = defaultdict(list)

    for item in raw_ingredients:
        name, quantity = parse_ingredient(item)
        if not is_staple(name):
            grouped[name].append(quantity)

    return dict(grouped)



def estimate_costs(ingredient_dict: dict, price_lookup: dict) -> dict:
    """
    Estimate cost per ingredient using a lookup table.
    """
    costs = {}
    for name, quantities in ingredient_dict.items():
        price = price_lookup.get(name.lower(), 0.0)
        total_units = len(quantities)  # rough count multiplier
        costs[name] = round(price * total_units, 2)
    return costs
