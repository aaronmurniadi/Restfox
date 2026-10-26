# ![Restfox](https://raw.github.com/flawiddsouza/Restfox/main/packages/ui/public/pwa-192x192.png "Restfox")

# Restfox

[**Web App**](https://restfox.dev) **|** [**Chrome Extension**](https://chromewebstore.google.com/detail/restfox/fihmegnabgglklkppphibngblkomlhcn) **|** [**Releases**](https://github.com/flawiddsouza/Restfox/releases) **|** [**Screenshots**](#screenshots) **|** [**Docs**](https://docs.restfox.dev) **|** [**Compiling**](#compiling) **|** [**Compiling Web Standalone**](#using-web-standalone)

Offline-First Minimalistic HTTP & Socket Testing Client for the Web

Watch video to see plugins in action:<br>
[<img src="https://img.youtube.com/vi/3cOQPm43Wus/hqdefault.jpg" width="600" height="300" width="100%"
/>](https://www.youtube.com/watch?v=3cOQPm43Wus)

## Installation

### Web

Use the hosted app at [restfox.dev](https://restfox.dev) or install the [Chrome extension](https://chromewebstore.google.com/detail/restfox/fihmegnabgglklkppphibngblkomlhcn).

### [Docker](https://hub.docker.com/r/flawiddsouza/restfox)

```
docker run --name Restfox -d -p 4004:4004 flawiddsouza/restfox:0.41.0
```

Start webapp using docker compose

```
docker-compose up -d
```

Start webapp using docker compose with custom port

```
docker-compose -p 5000:4004 up -d
```

Start webapp using docker compose with different version

```
RESTFOX_VERSION=0.41.0 docker-compose up -d
```

## Screenshots

<img src="screenshots/1.png?raw=true">

<img src="screenshots/2.png?raw=true">

### Response History

<img src="screenshots/3.png?raw=true">

### Context Menu

<img src="screenshots/8.png?raw=true">

### Environment Variables

<img src="screenshots/4.png?raw=true">
<img src="screenshots/5.png?raw=true">

### Plugins

<img src="screenshots/6.png?raw=true">
<img src="screenshots/7.png?raw=true">

# Compiling

## ui

### Development

```
npm run dev
```

### Distribution (PWA)

```
npm run build
```

### Chrome extension distribution

```
npm run build-extension
```

### Web Standalone distribution and development

```
npm run build-web-standalone
```

### To upgrade codemirror to latest version

```bash
npm i @codemirror/autocomplete@latest @codemirror/commands@latest @codemirror/lang-javascript@latest @codemirror/lang-json@latest @codemirror/language@latest @codemirror/search@latest @codemirror/state@latest @codemirror/view@latest
```

## Using web-standalone

```
git clone https://github.com/flawiddsouza/Restfox
cd Restfox/packages/ui
npm i
npm run build-web-standalone
cd ../web-standalone
npm i
npm start
```

By default npm start will run Restfox at port 4004. You can override the port by passing port like so `PORT=5040 npm start`.

## Docker Build Instructions

First refer to [**Compiling Web Standalone**](#using-web-standalone) to build successfully locally and use it normally.
Then in the project root directory (directory with Dockerfile), execute:

```
docker build -t restfox:xx .
```

> Note: xx is the version number

After the build is complete, use the following command to start the service:

```
docker run -d -p:4004:4004 restfox:xx
```

Visit after successful startup: localhost:4004

Alternatively, you can also use the pre-built Docker image available on [Docker Hub](https://hub.docker.com/r/flawiddsouza/restfox). See: [**Docker**](#docker).
