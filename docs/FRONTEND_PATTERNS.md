# Frontend Patterns

Conventions for tables, grids, shared components, and themes. Use this when building or modifying finance UIs, dashboards, or any page that uses tables or grids.

## Tables & Grids

| Library | Use case | Theme | Files |
|---------|----------|------|-------|
| **AG Grid** (ag-grid-community) | Unit-test execution grid, Encompass custom/native field browsers | alpine | `unit-tests.js`, `encompassCustomFields.js`, `encompassNativeFields.js` |
| **DataTables** | Pipeline, disasters, risk dashboards, tools | Bootstrap 5 | `pipeline-risk-dashboard.html`, loan pipeline tables, disaster tables |

**Rule:** Use AG Grid for Encompass field browsers and unit-test grids. Use DataTables for pipeline, disasters, and general tabular data.

### AG Grid

- CDN: `ag-grid-community`
- Theme: `ag-theme-alpine`
- Use `agGrid.createGrid()` or `new agGrid.Grid()`
- Set explicit `colId` per column
- See patterns in: `unit-tests.js`, `encompassCustomFields.js`, `encompassNativeFields.js`

### DataTables

- Bootstrap 5 integration: `dataTables.bootstrap5.min.css`
- Used for pipeline loans, disaster lists, risk summaries

## Shared Resources

| Path | Purpose |
|------|---------|
| `public/shared/modern-navbar.js` | Web component navbar |
| `public/shared/styles.css` | Shared styles |
| `public/shared/user-login.js` | User login |
| `public/shared/user-selector.js` | User selector |
| `public/shared/voice-widget.js` | Voice widget |
| `public/shared/dark-mode.js` | Dark mode toggle |
| `public/shared/quick-actions.js` | Quick actions |
| `public/shared/voice-commands.js` | Voice commands (module) |
| `public/shared/ai-chat-widget.js` | AI chat widget (module) |
| `public/shared/ai-insights-card.js` | AI insights card (module) |
| `public/shared/calculationEngine.js` | Calculation engine |
| `public/shared/calcEngineLibrary.js` | calcMath library |

## Navigation (modern-navbar)

The shared navbar (`public/shared/modern-navbar.js`) uses a hub-first structure with 5 top-level items: Home, Finance, Music, Entertainment, More.

### Nav structure

| Nav item | Contents |
|----------|----------|
| **Home** | Link to `/` |
| **Finance** | Finance Hub, Encompass Assistant, Encompass Hub, Pipeline Risk, Unit Tests, The Screen Test |
| **Music** | Music Research, Album Discovery, My Collection, Song Identifier, Spotify, Time Machine, All Music Tools |
| **Entertainment** | Boombox, Visualizer, Black Light, Poster Generator, Art Gallery, Ouija Board, All Entertainment |
| **More** | Bike Store, Wolfman Dave, Levi Assistant, Voice Guide, Family, Nature, Hub (All Tools) |

Additional tools (Parser, Mashup, Automator, Ruler, Transformer, Alchemist, Encompass Users, Risk Analysis, Grateful Dead Timeline, etc.) are reachable via **Finance Hub** (`/finance/index.html`) or **Hub** (`/`).

### Attributes

| Attribute | Purpose |
|-----------|---------|
| `brand="Custom Name"` | Override brand text (default: `DevConnect Labs`) |
| `compact` | Hide Entertainment as top-level; show only Home, Finance, Music, More |

Example: `<modern-navbar brand="My App" compact></modern-navbar>`

### Hub deep-links

The index hub page supports hash-based deep-links that auto-expand accordion sections: `/#headingMusic`, `/#headingEntertainment`, `/#headingBike`, `/#headingAI`, `/#headingNature`.

## Finance UI Structure

```
public/finance/
├── encompass-assistant.html
├── tool9.html              # The Screen Test
├── pipeline-risk-dashboard.html
├── encompass-hub-test.html
├── unit-tests.html
├── encompass-custom-fields.html
├── encompass-native-fields.html
├── asset-qualifier-calculator.html
├── closing-cost-calculator.html
├── cashout-refinance-calculator.html
├── fha-streamline-ntb-calculator.html
├── va-irrrl-calculator.html
└── js/
    ├── main.js
    ├── tool9.js
    ├── unit-tests.js
    ├── unit-tests-ai.js
    ├── encompassHub.js
    ├── encompassAnalytics.js
    └── ...
```

## Bootstrap & Styling

- Bootstrap 5 for layout and components
- Bootstrap Icons
- Custom CSS variables in pages (e.g. `--primary-color`, `--danger-color`)
- Inter or similar fonts via Google Fonts

## Voice Commands

Pages can integrate `voice-commands.js` for voice activation. Commands like "Open screen test" are defined in `public/shared/voice-commands.js`.

## Related

- **AGENTS.md** – AG Grid, DataTables conventions
- **docs/CALCULATION_ENGINE.md** – Forms with calculations
- **docs/DISASTER_RISK.md** – Pipeline risk dashboard
