"""Generates the curated sample datasets shipped with AutoData.

Three datasets, each chosen to exercise a different part of the product:

1. sales_data.csv      — retail sales: time series + categoricals + numerics
                         (with deliberately injected quality issues)
2. customer_churn.csv  — telecom churn: binary target, categoricals, numerics
3. web_traffic.csv     — daily marketing metrics: pure time series with trend
                         and weekly seasonality
"""

import random

import pandas as pd

random.seed(42)


def sales_data() -> pd.DataFrame:
    products = ["Laptop", "Phone", "Tablet", "Monitor", "Keyboard", "Mouse", "Headset", "Camera"]
    categories = ["Electronics", "Electronics", "Electronics", "Electronics", "Accessories", "Accessories", "Accessories", "Electronics"]
    regions = ["North", "South", "East", "West", "Central"]
    channels = ["Online", "Retail", "Distributor", "Online", "Retail"]
    price = [999.0, 799.0, 429.0, 249.0, 79.0, 39.0, 129.0, 549.0]

    rows = []
    for i in range(1200):
        idx = i % len(products)
        date = pd.Timestamp("2025-01-01") + pd.Timedelta(days=random.randint(0, 365))
        units = random.randint(1, 60)
        revenue = round(units * price[idx] * random.uniform(0.85, 1.2), 2)
        rows.append({
            "order_id": f"ORD-{1000 + i}",
            "order_date": date,
            "product": products[idx],
            "category": categories[idx],
            "region": random.choice(regions),
            "channel": random.choice(channels),
            "units": units,
            "unit_price": price[idx],
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

    return pd.DataFrame(rows)


def customer_churn() -> pd.DataFrame:
    tenure_buckets = [
        (1, 6), (7, 12), (13, 24), (25, 36), (37, 48), (49, 72), (73, 96), (97, 120),
    ]
    plans = ["Basic", "Standard", "Premium", "Premium Plus"]
    contracts = ["Month-to-month", "One year", "Two year"]
    payment = ["Electronic check", "Mailed check", "Bank transfer", "Credit card"]
    support_topics = ["Billing", "Technical", "Account", "Sales"]

    rows = []
    for i in range(1500):
        lo, hi = tenure_buckets[random.randrange(len(tenure_buckets))]
        tenure = random.randint(lo, hi)
        monthly = round(random.uniform(20, 120), 2)
        plan = plans[random.randrange(len(plans))]
        contract = contracts[random.randrange(len(contracts))]
        senior = random.choices([0, 1], weights=[0.8, 0.2])[0]
        # Churn correlates with short tenure + month-to-month + high charges
        churn_prob = 0.12 + (0.25 if tenure < 12 else 0) + (0.18 if contract == "Month-to-month" else 0)
        churn_prob = min(0.92, churn_prob + monthly / 600)
        churn = random.choices(["Yes", "No"], weights=[churn_prob, 1 - churn_prob])[0]
        rows.append({
            "customer_id": f"C-{10000 + i}",
            "tenure_months": tenure,
            "monthly_charges": monthly,
            "total_charges": round(monthly * tenure * random.uniform(0.95, 1.05), 2),
            "plan": plan,
            "contract": contract,
            "payment_method": random.choice(payment),
            "senior_citizen": senior,
            "support_calls": random.randint(0, 8),
            "avg_call_minutes": round(random.uniform(60, 900), 1),
            "churn": churn,
        })

    # Light quality issues: missing total_charges for a few brand-new customers
    for i in (3, 21, 74, 130):
        rows[i]["total_charges"] = None
    rows[55]["plan"] = " "
    rows[56]["plan"] = "standard"
    rows.append(rows[0])

    return pd.DataFrame(rows)


def web_traffic() -> pd.DataFrame:
    start = pd.Timestamp("2025-01-01")
    base = 800
    rows = []
    for i in range(365):
        date = start + pd.Timedelta(days=i)
        weekday = date.weekday()
        # Trend: steady growth across the year
        trend = base + i * 3.2
        # Weekly seasonality: weekends quieter, mid-week peak
        season = {0: -60, 1: 40, 2: 90, 3: 110, 4: 60, 5: -120, 6: -140}[weekday]
        noise = random.uniform(-40, 40)
        visits = int(max(0, trend + season + noise))
        sessions = int(visits * random.uniform(1.15, 1.3))
        signups = int(visits * random.uniform(0.02, 0.045))
        rows.append({
            "date": date,
            "visits": visits,
            "sessions": sessions,
            "signups": signups,
            "bounce_rate": round(random.uniform(28, 62), 1),
            "avg_session_minutes": round(random.uniform(2.5, 9.5), 1),
        })

    # A few missing values + a spike (marketing campaign)
    rows[40]["visits"] = None
    rows[90]["bounce_rate"] = None
    rows[150]["visits"] = int(rows[150]["visits"] * 2.4)
    rows[151]["signups"] = int(rows[151]["signups"] * 3.1)

    return pd.DataFrame(rows)


if __name__ == "__main__":
    root = "/workspace/sample_data"
    for name, fn in (
        ("sales_data", sales_data),
        ("customer_churn", customer_churn),
        ("web_traffic", web_traffic),
    ):
        df = fn()
        df.to_csv(f"{root}/{name}.csv", index=False)
        print(f"{name}.csv -> {len(df)} rows x {len(df.columns)} cols")
