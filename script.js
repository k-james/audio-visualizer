"use strict";

const APP_DEFAULTS = {
    dimensions: {
        x: 0,
        y: 0
    },
    camera: {
        fov: 45,
        nearPlane: 0.1,
        farPlane: 1000,
        aspectRatio: 0.7
    },
    styles: {
        // set the color of the ball here
        ballColor: 0xee3c49,
        planeColor: 0x6904ce,
        showPlanes: false
    },
    activateListener: ".make-google-happy-button"
};

const {
    PI
} = Math;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const fractionate = (v, min, max) => (v - min) / (max - min);
const modulate = (v, minIn, maxIn, minOut, maxOut) => minOut + (fractionate(v, minIn, maxIn) * (maxOut - minOut));
const avg = (arr) => arr.reduce((sum, b) => sum + b) / arr.length;
const max = (arr) => Math.max(...arr);

/**
 * Pass in a series of audio file urls and names/artists to pump out visuals
 */
class AudioVisualizer {
    /**
     * Provides an instance of the sphere audio visualizer.
     * @param {{name: string, artist: string, url: string}[]} files A collection of files to use for the rendering and track selection.
     */
    constructor(files) {
        this.files = files.map(f => f.url);
        this.titles = files.map(f => f.name);
        this.artists = files.map(f => f.artist);

        window.onresize = () => {
            this.setSize();
        };

        this.noise = new SimplexNoise();    // noise instance for calculating variance
        this.tick = 0;
        this.props = Object.assign({}, APP_DEFAULTS);
        this.initCamera();
        this.initScene();
        this.initLights();
        this.initUI();
        this.initAudio();
        this.btnMakeGoogleHappy = document.querySelector(this.props.activateListener);
        this.btnMakeGoogleHappy.addEventListener("click", () => {
            this.audioCtx.resume();
            this.loadAudio();
            this.btnMakeGoogleHappy.classList.add("hidden");
        });
        this.build();
        this.render();
    }

    setSize() {
        this.props.dimensions.x = window.innerWidth;
        this.props.dimensions.y = window.innerHeight;
        this.camera.aspect = this.props.camera.aspectRatio = this.props.dimensions.x / this.props.dimensions.y;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.props.dimensions.x, this.props.dimensions.y);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(this.props.camera.fov, this.props.camera.aspectRatio, this.props.camera.nearPlane, this.props.camera.farPlane);
        this.camera.position.set(0, 0, 100);
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.group = new THREE.Group();
        this.camera.lookAt(this.scene.position);
        this.scene.add(this.camera);
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });
        this.setSize();

        if (this.props.styles.showPlanes) {
            this.planeGeometry = new THREE.PlaneGeometry(800, 800, 20, 20);
            this.planeMaterial = new THREE.MeshLambertMaterial({
                color: this.props.styles.planeColor,
                side: THREE.DoubleSide,
                wireframe: true
            });
            this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
            this.plane.rotation.x = -0.5 * Math.PI;
            this.plane.position.set(0, 30, 0);
            this.group.add(this.plane);

            this.plane2 = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
            this.plane2.rotation.x = -0.5 * Math.PI;
            this.plane2.position.set(0, -30, 0);
            this.group.add(this.plane2);
        }

        this.icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
        this.lambertMaterial = new THREE.MeshLambertMaterial({
            color: this.props.styles.ballColor,
            wireframe: true,
            reflectivity: 0.25
        });

        this.ball = new THREE.Mesh(this.icosahedronGeometry, this.lambertMaterial);
        this.ball.position.set(0, 0, 0);
        this.group.add(this.ball);

        this.scene.add(this.group);
    }

    initLights() {
        this.ambientLight = new THREE.AmbientLight(0xaaaaaa);
        this.scene.add(this.ambientLight);

        this.spotLight = new THREE.SpotLight(0xffffff);
        this.spotLight.intensity = 0.9;
        this.spotLight.position.set(-10, 40, 20);
        this.spotLight.lookAt(this.ball);
        this.spotLight.castShadow = true;
        this.scene.add(this.spotLight);
    }

    initUI() {
        // this.orbitControls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.title = document.querySelector(".title");
        this.artist = document.querySelector(".artist");
        this.loader = document.querySelector(".loader");
        this.progressBar = document.querySelector(".progress-bar");
        this.controls = {
            container: document.querySelector(".controls"),
            prev: document.querySelector(".prev"),
            play: document.querySelector(".play"),
            next: document.querySelector(".next")
        };
        this.playIcon = this.controls.play.firstElementChild;

        this.controls.play.onclick = () => {
            if (this.playing && this.audioReady) {
                this.playIcon.innerHTML = "play_arrow";
                this.audio.pause();
            } else if (!this.playing && this.audioReady) {
                this.playIcon.innerHTML = "pause";
                this.audio.play();
            }

            this.playing = !this.playing;
        };

        this.controls.prev.onclick = () => {
            this.skipPrev();
        };

        this.controls.next.onclick = () => {
            this.skipNext();
        };
    }

    skipPrev() {
        this.currentSong = this.currentSong > 1 ? this.currentSong - 1 : this.files.length;
        this.loadAudio();
    }

    skipNext() {
        this.currentSong = this.currentSong < this.files.length ? this.currentSong + 1 : 1;
        this.loadAudio();
    }

    initAudio() {
        this.currentSong = 1;
        this.playing = false;
        this.audioReady = false;
        this.audio = document.querySelector(".audio");
        this.audio.addEventListener("ended", () => {
            this.audio.currentTime = 0;
            this.skipNext();
        });
        this.audio.addEventListener("timeupdate", () => {
            this.progressBar.style = `transform: scaleX(${this.audio.currentTime / this.audio.duration})`;
        });
        this.audioCtx = new AudioContext();
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.smoothingTimeConstant = 0.92;
        this.analyser.minDecibels = -120;
        this.analyser.maxDecibels = -5;
        this.analyser.fftSize = 512;
        this.source = this.audioCtx.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
        this.floatData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    loadAudio() {
        let request = new XMLHttpRequest();
        this.loader.classList.add("loading");
        this.controls.container.classList.remove("ready");
        this.playIcon.innerHTML = "play_arrow";
        request.responseType = "blob";
        request.open("GET", this.files[this.currentSong - 1], true);

        request.onprogress = () => {
            if (request.response) {
                this.audioReady = true;
                this.playing = true;
                this.playIcon.innerHTML = "pause";
                this.loader.classList.remove("loading");
                this.controls.container.classList.add("ready");
                this.title.innerHTML = this.titles[this.currentSong - 1];
                this.artist.innerHTML = this.artists[this.currentSong - 1];
                this.audio.src = window.URL.createObjectURL(request.response);
                this.audio.play();
            } else if (request.status !== 200) {
                this.audioReady = true;
                this.playing = false;
                this.loader.classList.remove("loading");
                this.controls.container.classList.add("ready");
            }
        };

        request.send();
    }

    build() {
        this.container = document.getElementById("out");
        this.container.appendChild(this.renderer.domElement);
    }

    render() {
        this.update();
        this.group.rotation.y += 0.005;
        this.renderer.render(this.scene, this.camera);
        window.requestAnimationFrame(this.render.bind(this));
    }

    update() {
        this.tick++;
        this.analyser.getByteFrequencyData(this.floatData);
        // slice the array into two halves
        var lowerHalfArray = this.floatData.slice(0, (this.floatData.length / 2) - 1);
        var upperHalfArray = this.floatData.slice((this.floatData.length / 2) - 1, this.floatData.length - 1);

        var overallAvg = avg(this.floatData);
        // do some basic reductions/normalisations
        var lowerMax = max(lowerHalfArray);
        var lowerAvg = avg(lowerHalfArray);
        var upperMax = max(upperHalfArray);
        var upperAvg = avg(upperHalfArray);

        var lowerMaxFr = lowerMax / lowerHalfArray.length;
        var lowerAvgFr = lowerAvg / lowerHalfArray.length;
        var upperMaxFr = upperMax / upperHalfArray.length;
        var upperAvgFr = upperAvg / upperHalfArray.length;
        /* use the reduced values to modulate the 3d objects */
        // these are the planar meshes above and below the sphere
        if (this.props.styles.showPlanes) {
            this.makeRoughGround(this.plane, modulate(upperAvgFr, 0, 1, 0.5, 4), this.noise);
            this.makeRoughGround(this.plane2, modulate(lowerMaxFr, 0, 1, 0.5, 4), this.noise);
        }
        // this modulates the sphere's shape.
        this.makeRoughBall(this.ball, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4), this.noise);
    }

    makeRoughBall(mesh, bassFr, treFr, noise) {
        mesh.geometry.vertices.forEach((vertex, i) => {
            var offset = mesh.geometry.parameters.radius;
            var amp = 7;
            var time = window.performance.now();
            vertex.normalize();
            var rf = 0.00001;
            var distance = (offset + bassFr) + noise.noise3D(vertex.x + time * rf * 7, vertex.y + time * rf * 8, vertex.z + time * rf * 9) * amp * treFr;
            vertex.multiplyScalar(distance);
        });
        mesh.geometry.verticesNeedUpdate = true;
        mesh.geometry.normalsNeedUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeFaceNormals();
    }

    makeRoughGround(mesh, distortionFr, noise) {
        mesh.geometry.vertices.forEach((vertex, i) => {
            var amp = 2;
            var time = Date.now();
            var distance = (noise.noise2D(vertex.x + time * 0.0003, vertex.y + time * 0.0001) + 0) * distortionFr * amp;
            vertex.z = distance;
        });
        mesh.geometry.verticesNeedUpdate = true;
        mesh.geometry.normalsNeedUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeFaceNormals();
    }
}

window.requestAnimationFrame = (() => {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (callback) {
        window.setTimeout(callback, 1000 / 60);
    };
})();

window.onload = () => {
    const sources = [
        {
            url: "https://res.cloudinary.com/sf-cloudinary/video/upload/v1525440296/Washed_Out_-_Feel_it_all_around.mp3",
            name: "Feel it all around",
            artist: "Washed Out"
        },
        {
            url: "https://res.cloudinary.com/sf-cloudinary/video/upload/v1525440296/Com_Truise_-_Colorvision.mp3",
            name: "Colorvision",
            artist: "Com Truise"
        },
        {
            url: "https://res.cloudinary.com/sf-cloudinary/video/upload/v1525440296/HOME_-_Resonance.mp3",
            name: "Resonance",
            artist: "HOME"
        },
        {
            url: "https://res.cloudinary.com/sf-cloudinary/video/upload/v1525440296/Vulfpeck_-_Back_Pocket.mp3",
            name: "Back Pocket",
            artist: "Vulfpeck"
        }
    ];
    let app = new AudioVisualizer(sources);
};
