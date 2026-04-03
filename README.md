<h1 align="center">Super Terminal</h1>
<p align="center">Manage Terminals Easy! And Save Time!</p>
<p align="center">
	<img src="src-tauri/icons/icon.png" width="128" />
</p>

1. Do you find **opening the terminal after reboot** boring?
2. Do you **work on multiple folders**, like monorepo or full stack projects, in parallel?
3. Do you **need environment variables** always in some project?
4. Is running a project requires you to **run multiple commands** in different folders and you wanna automate that?
5. Do you want to open terminal from **other machine** over LAN using HTTP?

## Features

1. **Restoration** of terminal with logs after reboot
2. Fit Terminals on Screen with a single click
3. Ability to run command at start while opening the project like `git config --user.name`
4. Run project with one click
5. Set Environment Variables once and never again
6. **Clone Terminal** with same current directory, env variables
7. Ability to group related terminals together under 1 project within view
8. Themes can be applied: https://windowsterminalthemes.dev/
9. Easily **enter multiline commands like curl** by double clicking on any terminal
10. Works with [oh my zsh](https://ohmyz.sh/)
11. Save **frequent commands as shell scripts** and execute with a click
12. **Auto-delete logs** by size to keep disk usage in check

## Installation

### Desktop App

Available for macOS (Apple Silicon), Linux, and Windows.

**Homebrew (macOS):**
```bash
brew tap bugwheels94/super-terminal
brew install --cask super-terminal
```

**Or download** from the [Latest Release](https://github.com/bugwheels94/super-terminal/releases/latest).

> **macOS:** If you see "app is damaged" or "can't be opened", run:
> ```bash
> sudo xattr -d com.apple.quarantine /Applications/Super\ Terminal.app
> ```

### Headless Server

For running on remote machines, servers, or without a GUI.

**Quick install (macOS/Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/bugwheels94/super-terminal/master/install.sh | sh
```

**Homebrew:**
```bash
brew tap bugwheels94/super-terminal
brew install super-terminal-headless
```

**Or download** from the [Latest Release](https://github.com/bugwheels94/super-terminal/releases/latest).

## How to Run

### Desktop App

Launch **Super Terminal** from your Applications folder or start menu. It opens automatically at [http://localhost:3879](http://localhost:3879).

### Headless Server

```bash
super-terminal-headless
```

Open in browser at: [http://localhost:3879](http://localhost:3879)

## Configuration

Config file location: `~/.config/super-terminal/config` (YAML)

```yaml
port: 3879
host: 127.0.0.1
```

### CLI Options

```bash
super-terminal-headless --port 4000 --host 0.0.0.0
```

### Environment Variables

```bash
SUPER_TERMINAL_PORT=4000 SUPER_TERMINAL_HOST=0.0.0.0 super-terminal-headless
```

## Development

```bash
# Install dependencies
npm install

# Run in dev mode (Tauri + Vite)
npm run tauri dev

# Build the desktop app
npm run tauri build

# Build the headless server
cargo build --release -p super-terminal
```
