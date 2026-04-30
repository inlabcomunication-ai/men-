# Security Specification - Pizzeria Dashboard

## Data Invariants
1. A Pizzeria record must have a valid `ownerId` matching the creator's UID.
2. Only the owner can update or delete their pizzeria record.
3. The `ownerId` field is immutable after creation.
4. All menus must have exactly the 5 required categories (pizze, bianche, speciali, pucce, bibite).
5. Public users can read (get) a pizzeria record if they have the ID, but cannot list all pizzerias.

## The "Dirty Dozen" Payloads (Deny Cases)

1. **Identity Spoofing**: Attempt to create a pizzeria with an `ownerId` that doesn't match the auth UID.
2. **Resource Poisoning**: Use a 2KB string as `pizzeriaId`.
3. **Ghost Field Injection**: Add `isVerified: true` to the pizzeria document.
4. **Malicious Menu**: Send a menu category as a string instead of a list.
5. **PII Leak**: (N/A for this app, but rules forbid blanket reads).
6. **Immutable Field Attack**: Attempt to change `ownerId` via update.
7. **Client Timestamp Spoofing**: Provide a future/past `updatedAt` instead of `request.time`.
8. **Invalid Price**: Set a pizza price to -10 or "free".
9. **Missing Required Field**: Create a pizzeria without a `title`.
10. **Unauthorized Update**: Attempt to update someone else's pizzeria.
11. **Unauthorized Delete**: Attempt to delete someone else's pizzeria.
12. **Broad Listing**: Attempt to query all pizzerias without a specific document ID.

## Risk Assessment
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| pizzerias | BLOCKED (isValidPizzeria checks ownerId) | N/A (no status flow) | BLOCKED (isValidId and size checks) |
