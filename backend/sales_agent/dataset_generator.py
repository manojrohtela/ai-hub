import os
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd


PRODUCTS = ["Phone", "Laptop", "Tablet", "Headphones", "Smartwatch"]
REGIONS = ["India", "US", "Europe", "Middle East", "Asia"]


def _generate_date_range(n_rows: int) -> np.ndarray:
    """Generate a sequence of dates over recent months."""
    end_date = datetime.today().date()
    start_date = end_date - timedelta(days=120)
    all_days = pd.date_range(start=start_date, end=end_date, freq="D")
    # Sample with replacement to get exactly n_rows, preserving weekend frequency
    sampled = np.random.choice(all_days, size=n_rows, replace=True)
    return np.sort(sampled)


def generate_demo_dataset(
    n_rows: int = 500,
    random_seed: int = 42,
    save_path: Optional[str] = None,
) -> pd.DataFrame:
    """
    Generate a realistic synthetic business dataset.

    Columns: date, product, region, revenue, units_sold, marketing_spend
    Business rules:
    - Revenue between 1000 and 50000
    - Marketing spend positively influences revenue
    - Phones generally sell more
    - Europe slightly weaker revenue
    - Weekend sales slightly higher
    """
    np.random.seed(random_seed)

    dates = _generate_date_range(n_rows)

    # Product distribution: Phones sell more
    product_probs = np.array([0.35, 0.2, 0.15, 0.15, 0.15])
    products = np.random.choice(PRODUCTS, size=n_rows, p=product_probs)

    # Region distribution: Europe slightly weaker
    region_probs = np.array([0.22, 0.25, 0.15, 0.18, 0.2])
    regions = np.random.choice(REGIONS, size=n_rows, p=region_probs)

    # Base marketing spend per row
    base_marketing = np.random.gamma(shape=3.0, scale=500.0, size=n_rows)

    # Product-level multipliers
    product_marketing_factor = {
      "Phone": 1.1,
      "Laptop": 1.0,
      "Tablet": 0.9,
      "Headphones": 0.8,
      "Smartwatch": 0.85,
    }
    region_marketing_factor = {
      "India": 1.0,
      "US": 1.1,
      "Europe": 0.9,
      "Middle East": 1.0,
      "Asia": 1.05,
    }

    marketing_spend = []
    for prod, reg, base in zip(products, regions, base_marketing):
        val = base
        val *= product_marketing_factor[prod]
        val *= region_marketing_factor[reg]
        marketing_spend.append(val)
    marketing_spend = np.array(marketing_spend)

    # Weekend sales slightly higher
    weekend_boost = []
    for d in dates:
        weekday = pd.Timestamp(d).weekday()
        if weekday >= 5:  # Saturday/Sunday
            weekend_boost.append(1.15)
        else:
            weekend_boost.append(1.0)
    weekend_boost = np.array(weekend_boost)

    # Base revenue as function of marketing spend, product, region, and weekend
    product_revenue_factor = {
      "Phone": 1.2,
      "Laptop": 1.1,
      "Tablet": 1.0,
      "Headphones": 0.9,
      "Smartwatch": 0.95,
    }
    region_revenue_factor = {
      "India": 1.0,
      "US": 1.15,
      "Europe": 0.9,  # slightly weaker
      "Middle East": 1.05,
      "Asia": 1.05,
    }

    base_revenue = []
    for m, prod, reg, w_boost in zip(marketing_spend, products, regions, weekend_boost):
        # marketing-driven component
        revenue = m * np.random.uniform(3.0, 6.0)
        revenue *= product_revenue_factor[prod]
        revenue *= region_revenue_factor[reg]
        revenue *= w_boost
        # noise
        noise = np.random.normal(loc=0.0, scale=revenue * 0.15)
        revenue = max(1000.0, min(50000.0, revenue + noise))
        base_revenue.append(revenue)
    revenue = np.array(base_revenue)

    # Units sold derived from revenue and rough ASP by product
    avg_price = {
      "Phone": 700,
      "Laptop": 1500,
      "Tablet": 500,
      "Headphones": 150,
      "Smartwatch": 300,
    }
    units_sold = []
    for rev, prod in zip(revenue, products):
        price = avg_price[prod]
        units = rev / price
        # some noise
        units *= np.random.uniform(0.8, 1.2)
        units_sold.append(max(1, int(round(units))))
    units_sold = np.array(units_sold, dtype=int)

    df = pd.DataFrame(
        {
            "date": pd.to_datetime(dates).date,
            "product": products,
            "region": regions,
            "revenue": revenue.round(2),
            "units_sold": units_sold,
            "marketing_spend": marketing_spend.round(2),
        }
    )

    if save_path:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        df.to_csv(save_path, index=False)

    return df


def load_or_generate_demo_dataset(
    csv_path: str,
    n_rows: int = 500,
    random_seed: int = 42,
) -> pd.DataFrame:
    """
    Load the demo dataset if it exists, otherwise generate and save it.
    """
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path, parse_dates=["date"])
    return generate_demo_dataset(n_rows=n_rows, random_seed=random_seed, save_path=csv_path)


if __name__ == "__main__":
    # Convenience entry point to generate the demo dataset from CLI
    default_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "demo_dataset.csv")
    df_demo = generate_demo_dataset(save_path=default_path)
    print(f"Generated demo dataset with {len(df_demo)} rows at {default_path}")
