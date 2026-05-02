# Bubuzinha Heart Particles

A small browser animation built with Vite and Three.js. By default the word **Bubuzinha** appears as a cloud of particles, explodes outward, and reforms into a heart in a looping 3D scene.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

To show a different name, open the site with a `text` query parameter:

```text
http://localhost:5173/?text=Anna
```

 ## Build
 
 ```bash
 npm run build
 ```

## Deploy

This project is configured to deploy automatically to GitHub Pages on every push to `main`.

After deployment, you can customize the displayed name with the same query parameter:

```text
https://dniggeler.github.io/splashvideo/?text=Anna
```
