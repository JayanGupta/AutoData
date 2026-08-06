"""Generates a realistic sample sales dataset (CSV + Excel) for testing."""
import random

import pandas as pd

random.seed(42)

products = ["Laptop", "Phone", "Tablet", "Monitor", "Keyboard", "Mouse", "Headset", "Camera"]
categories = ["Electronics", "Electronics", "Electronics", "Electronics", "Accessories", "Accessories", "Accessories", "Electronics"]
regions = ["North", "South", "East", "West", "Central"]
channels = ["Online", "Retail", "Distributor", "Online", "Retail"]

rows = []
n = 1200
for i in range(n):
    idx = i % len(products)
    product = products[idx]
    date = pd.Timestamp("2025-01-01") + pd.Timedelta(days=random.randint(0, 365))
    units = random.randint(1, 60)
    unit_price = [999.0, 799.0, 429.0, 249.0, 79.0, 39.0, 129.0, 549.0][idx]
    revenue = round(units * unit_price * random.uniform(0.85, 1.2), 2)
    rows.append({
        "order_id": f"ORD-{1000 + i}",
        "order_date": date,
        "product": product,
        "category": categories[idx],
        "region": random.choice(regions),
        "channel": random.choice(channels),
        "units": units,
        "unit_price": unit_price,
        "revenue": revenue,
        "customer_rating": round(random.uniform(1, 5), 1),
        "returned": random.choices(["Yes", "No"], weights=[0.08, 0.92])[0],
    })

# Inject realistic quality issues
for i in (5, 42, 88, 200, 500):
    rows[i]["revenue"] = None
for i in (12, 99):
    rows[i]["customer_rating"] = None
rows[130]["units"] = "N/A"
rows[131]["units"] = "-"
rows[300]["revenue"] = 999999
rows[301]["revenue"] = -9999
rows.append(rows[3])  # duplicate

df = pd.DataFrame(rows)
df.to_csv("/workspace/sample_data/sales_data.csv", index=False)
df.to_excel("/workspace/sample_data/sales_data.xlsx", index=False)
print(f"Generated {len(df)} rows x {len(df.columns)} cols")
print(df.head(3).to_string())
