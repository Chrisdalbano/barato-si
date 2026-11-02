Synthetic Keepa Browsing Deals response, not a captured paid API response.

Schema: https://keepa.com/api-docs/deal-object.html and https://keepa.com/api-docs/deals.html (checked 2026-11-02). `deals.dr` contains deal objects; `current[0]` is Amazon price in cents for domain 1; -1 means unavailable. The adapter deliberately does not treat average prices as list prices.
