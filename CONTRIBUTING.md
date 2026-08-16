# Contributing to AutoData

Thank you for considering contributing! This guide covers the essentials.

## Getting started

1. Fork the repo and clone your fork.
2. Create a branch: `git checkout -b feat/your-feature`
3. Install deps — see [Quick start](README.md#quick-start).
4. Make your changes and run the test suite:
   ```bash
   cd backend
   python -m unittest tests.test_engine tests.test_features tests.test_api -v
   ```
5. Open a pull request against `main`.

## Branch naming

| Type | Pattern |
| --- | --- |
| Feature | `feat/<short-description>` |
| Bug fix | `fix/<short-description>` |
| Docs | `docs/<short-description>` |
| Chore | `chore/<short-description>` |

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add CSV export endpoint
fix: handle empty column edge case in profiler
docs: update deploy instructions
```

## Code style

- **Python**: follow PEP 8; format with `black .` before committing.
- **TypeScript/React**: run `npm run lint` from `frontend/`.
- Keep functions small and focused; prefer explicit over implicit.

## Reporting bugs

Open an issue with:
- Steps to reproduce
- Expected vs. actual behaviour
- AutoData version / OS / Python version

## Suggesting features

Open a discussion or issue labelled `enhancement` before coding, so we can align on scope first.
