module.exports = {
  packagerConfig: {
    name: "Zeet Player",
    executableName: "ZeetPlayer",
    asar: false,
  },
  plugins: [
    {
      name: "@electron-forge/plugin-vite",
      config: {
        build: [
          {
            entry: "electron/main.ts",
            config: "vite.main.config.ts",
          },
          {
            entry: "electron/preload.ts",
            config: "vite.preload.config.ts",
          },
        ],
        renderer: [
          {
            config: "vite.config.ts",
          },
        ],
      },
    },
  ],
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "ZeetPlayer",
        setupExe: "ZeetPlayer-Setup.exe",
        noMsi: true,
        description: "Zeet Player - music player with Yandex Music and YouTube Music support",
      },
    },
  ],
};
