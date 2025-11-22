# Release Automation Guide

This document describes the automated release process with semantic versioning.

## Overview

The release automation system provides:
- **Automatic version bumping** based on semantic versioning
- **Changelog generation** from commit messages
- **GitHub releases** with release notes
- **Commit message validation** using conventional commits

## How It Works

### 1. Commit Message Convention

All commits should follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes (dependencies, etc.)
- `revert`: Revert a previous commit

**Examples:**
```
feat(core): add Vec3.lerp method
fix(world): resolve entity disposal memory leak
docs: update API documentation
chore: update dependencies
```

### 2. Release Process

#### Manual Release (Recommended)

1. Go to GitHub Actions → "Release" workflow
2. Click "Run workflow"
3. Select version type:
   - **major**: Breaking changes (1.0.0 → 2.0.0)
   - **minor**: New features, backward compatible (1.0.0 → 1.1.0)
   - **patch**: Bug fixes, backward compatible (1.0.0 → 1.0.1)
4. Click "Run workflow"

The workflow will:
- Run tests to ensure everything passes
- Generate changelog from commits since last release
- Bump version in `package.json`
- Create git tag (e.g., `v1.0.1`)
- Create GitHub release with changelog

#### Automatic Release (Future)

Currently, releases are manual. Future enhancement could trigger releases automatically on merge to `main` based on commit types.

### 3. Commit Message Validation

Commit messages are validated:
- **In CI**: For pull requests, commit messages are validated automatically
- **Locally**: Use `pnpm commitlint:last` to validate the last commit

To validate all commits in a PR:
```bash
pnpm commitlint:last
```

### 4. Changelog

The changelog is automatically generated from commit messages using the `metcalfc/changelog-generator` action. It groups changes by type:
- Features
- Bug fixes
- Documentation
- Performance
- etc.

The changelog is included in:
- GitHub release notes
- `CHANGELOG.md` file (manually maintained template)

## Usage Examples

### Creating a Feature Release

1. Make commits with `feat:` prefix:
   ```bash
   git commit -m "feat(core): add new math utilities"
   git commit -m "feat(world): implement new ECS query system"
   ```

2. Merge PR to `main`

3. Run release workflow with `minor` version type

### Creating a Bug Fix Release

1. Make commits with `fix:` prefix:
   ```bash
   git commit -m "fix(script): resolve memory leak in LogicCube execution"
   ```

2. Merge PR to `main`

3. Run release workflow with `patch` version type

### Creating a Major Release

1. Ensure all breaking changes are documented
2. Make commits (can include `feat:`, `fix:`, etc.)
3. Run release workflow with `major` version type

## Troubleshooting

### Commit Message Validation Fails

If commitlint fails, check:
1. Commit message follows conventional commits format
2. Type is one of: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
3. Subject line is not empty and follows format

**Fix:**
```bash
# Amend last commit message
git commit --amend -m "feat(core): proper commit message"
```

### Release Workflow Fails

Common issues:
1. **Tests fail**: Fix failing tests before releasing
2. **No commits since last release**: Ensure there are new commits
3. **Permission issues**: Check GitHub token permissions

### Version Not Bumping

If version doesn't update:
1. Check `package.json` has correct version format
2. Ensure workflow has write permissions
3. Check workflow logs for errors

## Best Practices

1. **Write clear commit messages**: They become your changelog
2. **Use appropriate types**: Helps categorize changes
3. **Scope when relevant**: Helps identify which package changed
4. **Test before releasing**: Always ensure tests pass
5. **Review changelog**: Check generated changelog before publishing

## Platform UI

Release management jest dostępny w panelu administracyjnym platformy:

1. Zaloguj się jako admin
2. Przejdź do `/admin`
3. Kliknij "Release Management" 🚀

**Funkcje UI:**
- Wyświetlanie statystyk release'ów
- Lista wszystkich release'ów z statusami
- Tworzenie nowych release'ów (major/minor/patch)
- Linki do GitHub releases
- Podgląd changelog

**Wymagania:**
- Backend API musi implementować endpointy z [RELEASE_API.md](./RELEASE_API.md)
- Uprawnienia admina do wywoływania GitHub Actions workflow

## Configuration Files

- `.github/workflows/release.yml` - Release workflow
- `.commitlintrc.json` - Commit message rules
- `CHANGELOG.md` - Manual changelog template
- `package.json` - Version storage
- `apps/platform/src/components/admin/ReleaseAdmin.tsx` - UI component
- `apps/platform/src/pages/admin/ReleaseManagementPage.tsx` - Admin page

## Related Documentation

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [AUTOMATION_ROADMAP.md](./AUTOMATION_ROADMAP.md) - Full automation roadmap
- [RELEASE_API.md](./RELEASE_API.md) - Backend API documentation

