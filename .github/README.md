# P.A.I.N. - Painstaking Agony Induced Nuisance

This is a mod for [Single Player Tarkov](https://www.sp-tarkov.com/).

# To install:

1. Decompress the contents of the download into your root SPT directory.
3. Leave a review and let me know what you think.

If you experience any problems, please [submit a detailed bug report](https://github.com/refringe/PAIN/issues).

# To Build Locally:

This project has been built in [Visual Studio Code](https://code.visualstudio.com/) (VSC) using [Node.js](https://nodejs.org/). If you are unfamiliar with Node.js, I recommend using [NVM](https://github.com/nvm-sh/nvm) to manage installation and switching versions. If you do not wish to use NVM, you will need to install the version of Node.js listed within the `.nvmrc` file manually.

This project uses [Biome](https://biomejs.dev/) to format code on save.

To build the project locally:

1. Clone the repository.
2. Open the `mod.code-workspace` file in Visual Studio Code (VSC).
3. Install the [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) VSC extension.
4. Install the [JSON5](https://marketplace.visualstudio.com/items?itemName=mrmlnc.vscode-json5) VSC extension.
5. Run `nvm use` in the terminal.
6. Run `npm install` in the terminal.
7. Run `npm run build` in the terminal.
