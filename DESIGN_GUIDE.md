# SupportAI interface guide

SupportAI is a support operations desk: help an agent find the right answer, see its evidence, and hand the conversation to a person when needed. The interface should feel steady, clear, and quick under daily use.

## Art direction: Harbor Signal

- **Palette:** Mineral `#F1F5F2`, paper `#FCFDFC`, evergreen `#14251F`, sea glass `#2D725F`, and brass `#B57A36`. Red and green are reserved for real error and success states.
- **Themes:** Keep the navigation rail evergreen in both themes. Light content uses a mineral canvas and near-white working surface. Dark content uses green-black canvas and lifted green surfaces. Use the semantic variables in `app/globals.css` for every state.
- **Type:** Geist Sans for the product UI and Geist Mono for code, IDs, and technical snippets. Use sentence case, short labels, readable 14–16px body text, and compact but distinct page titles.
- **Rhythm:** Work in 4px increments. Typical control height is 40–44px; control radius 10px; panel radius 14px. Keep action bars close to the task and avoid a wall of identical cards.
- **Icons:** Use the existing 18px outline SVG family with a consistent 1.75–2px stroke. Icons beside visible labels are decorative; icon-only controls need an accessible name.
- **Surfaces:** Use canvas and tonal sections first. Reserve borders for controls, selected rows, and meaningful separation. Use elevation sparingly for overlays and primary working panels.
- **Interaction:** Every action has hover, focus-visible, pressed, disabled, loading, success, and error treatment appropriate to its behavior. Keep keyboard order aligned with the screen, use 44px touch targets where practical, and respect reduced motion.

## Page composition

- **Workspace:** Evergreen navigation rail plus one route heading and one clear content hierarchy. Keep the active route obvious and show only useful context in the mobile bar.
- **Chat:** Conversation is the main canvas; citations and feedback stay under the answer they describe; composer remains anchored.
- **Inbox and history:** Compact, selectable list beside a readable detail view on wide screens. On small screens show one view at a time with a visible back action.
- **Knowledge and installation:** Put the primary task first, then show real processing or verification state and the next useful action. Never imply unsupported capabilities.
- **Settings and profile:** Group related controls with a clear reading order and keep save/apply behavior tied to the existing persistence model.
- **Public and embedded surfaces:** Share the same type and color voice while keeping visitor-facing chat calmer and simpler than the operator workspace.

## Token map

Use `--background`, `--surface`, `--surface-raised`, `--surface-muted`, `--text-primary`, `--text-secondary`, `--border`, `--accent`, `--accent-link`, `--accent-soft`, `--focus`, `--success`, `--warning`, `--error`, and their soft status variants. Navigation uses the `--nav-*` family. Do not add per-page hex colors for common interface states.
