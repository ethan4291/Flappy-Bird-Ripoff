# Flappy Bird Ripoff

A minimal Flappy Bird clone written in Python using pygame. No virtual environment is required; instructions below install dependencies globally or into your chosen Python environment.

Requirements

- Python 3.8+
- pygame

Install pygame (no venv):

```bash
python3 -m pip install --upgrade pip
python3 -m pip install pygame
```

Run the game:

```bash
python3 main.py
```

Controls

- Space or Up arrow: flap
- Mouse click: flap
- Esc: quit

Notes

- The project intentionally avoids external image/sound assets and uses simple shapes so it runs out of the box.
- If you prefer an isolated environment later, creating a virtualenv or using pipx is recommended but optional.

Publishing the browser-playable game to GitHub Pages
---------------------------------------------------

This repository now includes a small static website (index.html, css/, js/) that runs a browser port of the game using the existing `data/` assets. To publish it on GitHub Pages:

1. Commit and push your code to GitHub.
2. In your repository settings > Pages, select the branch (usually `main` or `master`) and root `/` as the publishing source, or create a `gh-pages` branch and push the built site there.
3. After a minute the site will be available at `https://<your-username>.github.io/<repo-name>/`.

Quick local test

Start a local HTTP server from the project root and open http://localhost:8000

```bash
python3 -m http.server 8000 --directory .
```

If you prefer to keep the Python/pygame source and the web port separate, consider creating a branch named `gh-pages` containing just the static files.

