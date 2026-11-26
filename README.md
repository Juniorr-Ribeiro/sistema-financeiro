# Controle da Casa — Household Budget Tracker

A small full-stack web app to track a household budget around two pay dates per month (day 5 and day 20). It calculates the surplus or shortfall for each pay date and for the whole month, tracks installment purchases, credit cards and which bills were already paid.

The interface is in Brazilian Portuguese. All data in this repository is fictional demo data.

## Features

- Two columns per month, one for each pay date, each with an editable income
- Automatic **surplus / shortfall** per pay date and per month
- Installment tracking (e.g. `3/12`) and card/account per item
- "Paid" checkbox per item
- **New month** button that copies the previous month, advances every installment (`3/6` becomes `4/6`) and drops the ones that ended
- Planned **budget** by category
- Password login (it is financial data)
- Responsive layout that works on a phone

## Tech stack

- Node.js 18+ and Express
- Vanilla JavaScript, HTML and CSS on the front end (no framework)
- JSON file persistence with atomic writes

## Run locally

```bash
npm install
APP_PASSWORD="choose-a-password" npm start
```

On Windows PowerShell:

```powershell
$env:APP_PASSWORD="choose-a-password"; npm start
```

Open http://localhost:3000 and sign in with the password you chose.

`APP_PASSWORD` is required (at least 8 characters). There is no default password.

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `APP_PASSWORD` | yes | Password used to sign in |
| `PORT` | no | Port to listen on (default `3000`) |
| `SESSION_SALT` | no | Extra salt for the session token |

## Where data is stored

Everything is saved in `data/db.json`, created on first start from the demo data in `seed.js`. This folder is ignored by git, so your real data is never committed. Back up that file from time to time.

## Project structure

```
controle-financeiro/
├── server.js     # login, API and static file server
├── seed.js       # fictional demo data
├── package.json
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

## Notes

This is a personal project built with AI-assisted development (Claude). I defined the requirements, reviewed the code and tested the behavior. It is intended for a small private deployment, not as a multi-user product: there is a single shared password and no rate limiting.

## License

MIT
