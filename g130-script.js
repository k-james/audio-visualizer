<script src="https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.2/dat.gui.min.js"></script> 
<script src="https://cdn.jsdelivr.net/npm/three-orbitcontrols@2.1.2/OrbitControls.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/simplex-noise/2.3.0/simplex-noise.min.js"></script>
<script scr="https://cdn.rawgit.com/mrdoob/three.js/master/examples/js/controls/OrbitControls.js"></script>
<script>
    var noise = new SimplexNoise();
    var tracks = [
        {
            url: 'https://res.cloudinary.com/sf-cloudinary/video/upload/v1525440296/Washed_Out_-_Feel_it_all_around.mp3',
            name: "Washed Out",
            artist: "Feel it all Around",
            data: null
        },
        {
            url: 'https://res.cloudinary.com/sf-cloudinary/video/upload/v1525440296/Com_Truise_-_Colorvision.mp3',
            name: "Com Truise",
            artist: "Colorvision",
            data: null
        }
    ];
    var activeTrackIndex = 0;
    var playing = false;
    var audioReady = false;
    var audio = document.createElement('AUDIO');
    var vizInit = function () {
        var src = null;
        var context = null;
        var backBtn = document.getElementById('skip-back-btn');
        var nextBtn = document.getElementById('skip-next-btn');
        var playBtn = document.getElementById('play-pause-btn');
        var playIcon = document.getElementById('play-show-icon');
        var pauseIcon = document.getElementById('pause-show-icon');
        var trackName = document.getElementById('track-name');
        var artistName = document.getElementById('artist-name');
        var loadAudio = function () {
            audioReady = false;
            if (tracks[activeTrackIndex].data) {
                URL.revokeObjectURL(tracks[activeTrackIndex].data);
            }
            let request = new XMLHttpRequest();
            request.responseType = "blob";
            request.open("GET", tracks[activeTrackIndex].url, true);
            request.onprogress = () => {
                if (request.response) {
                    audioReady = true;
                    tracks[activeTrackIndex].data = URL.createObjectURL(request.response)
                    audio.src = tracks[activeTrackIndex].data;
                    audio.load();
                    onTrackChange();
                }
            };
            request.send();
        }
        document.body.onclick = function (e) {
            playIcon.classList.add('hide');
            loadAudio();
            document.body.onclick = null;
        }
        playBtn.onclick = function (e) {
            if (playing) {
                playIcon.classList.add('hide');
                pauseIcon.classList.remove('hide');
                audio.pause();
                playing = false;
            } else {
                playIcon.classList.remove('hide');
                pauseIcon.classList.add('hide');
                audio.play();
                playing = true;
            }
        };
        backBtn.onclick = function (e) {
            activeTrackIndex--;
            if (activeTrackIndex < 0) {
                activeTrackIndex = tracks.length - 1;
            }
            audio.pause();
            playing = false;
            loadAudio();
        }
        nextBtn.onclick = function (e) {
            activeTrackIndex++;
            if (activeTrackIndex >= tracks.length) {
                activeTrackIndex = 0;
            }
            audio.pause();
            playing = false;
            loadAudio();
        }
        audio.addEventListener('ended', (event) => {
            activeTrackIndex++;
            if (activeTrackIndex >= tracks.length) {
                activeTrackIndex = 0;
            }
            loadAudio();
        });

        var onTrackChange = function () {
            play();
            playing = true;
            trackName.innerHTML = tracks[activeTrackIndex].name;
            artistName.innerHTML = tracks[activeTrackIndex].artist;
        }
        
        function play() {
            if (!src) {
                context = new AudioContext();
                src = context.createMediaElementSource(audio);
            } else {
                context.resume();
            }
            var analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = 0.92;
            analyser.minDecibels = -120;
            analyser.maxDecibels = -5;
            analyser.fftSize = 2048;
            src.connect(analyser);
            analyser.connect(context.destination); 
            analyser.fftSize = 512;
            var bufferLength = analyser.frequencyBinCount;
            var dataArray = new Uint8Array(bufferLength);
            var scene = new THREE.Scene();
            var group = new THREE.Group();
            var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 0, 100);
            camera.lookAt(scene.position);
            scene.add(camera);
            var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            var planeGeometry = new THREE.PlaneGeometry(800, 800, 20, 20);
            var planeMaterial = new THREE.MeshLambertMaterial({
                color: 0x6904ce,
                side: THREE.DoubleSide,
                wireframe: true
            });
            var plane = new THREE.Mesh(planeGeometry, planeMaterial);
            plane.rotation.x = -0.5 * Math.PI;
            plane.position.set(0, 30, 0);
            group.add(plane);
            var plane2 = new THREE.Mesh(planeGeometry, planeMaterial);
            plane2.rotation.x = -0.5 * Math.PI;
            plane2.position.set(0, -30, 0);
            group.add(plane2);
            var icosahedronGeometry = new THREE.IcosahedronGeometry(10, 4);
            var lambertMaterial = new THREE.MeshLambertMaterial({
                color: 0xff00ee,
                wireframe: true
            });
            var ball = new THREE.Mesh(icosahedronGeometry, lambertMaterial);
            ball.position.set(0, 0, 0);
            group.add(ball);
            var ambientLight = new THREE.AmbientLight(0xaaaaaa);
            scene.add(ambientLight);
            var spotLight = new THREE.SpotLight(0xffffff);
            spotLight.intensity = 0.9;
            spotLight.position.set(-10, 40, 20);
            spotLight.lookAt(ball);
            spotLight.castShadow = true;
            scene.add(spotLight);
            scene.add(group);
            document.getElementById('out').appendChild(renderer.domElement);
            window.addEventListener('resize', onWindowResize, false);
            if (audioReady) {
                audio.play();
            }
            render();
            function render() { 
                analyser.getByteFrequencyData(dataArray);
                var lowerHalfArray = dataArray.slice(0, (dataArray.length / 2) - 1);
                var upperHalfArray = dataArray.slice((dataArray.length / 2) - 1, dataArray.length - 1);
                var overallAvg = avg(dataArray);
                var lowerMax = max(lowerHalfArray);
                var lowerAvg = avg(lowerHalfArray);
                var upperMax = max(upperHalfArray);
                var upperAvg = avg(upperHalfArray);

                var lowerMaxFr = lowerMax / lowerHalfArray.length;
                var lowerAvgFr = lowerAvg / lowerHalfArray.length;
                var upperMaxFr = upperMax / upperHalfArray.length;
                var upperAvgFr = upperAvg / upperHalfArray.length;
                makeRoughGround(plane, modulate(upperAvgFr, 0, 1, 0.5, 4));
                makeRoughGround(plane2, modulate(lowerMaxFr, 0, 1, 0.5, 4));
                makeRoughBall(ball, modulate(Math.pow(lowerMaxFr, 0.8), 0, 1, 0, 8), modulate(upperAvgFr, 0, 1, 0, 4));
                group.rotation.y += 0.005;
                renderer.render(scene, camera);
                requestAnimationFrame(render);
            }
            function onWindowResize() {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
            function makeRoughBall(mesh, bassFr, treFr) {
                mesh.geometry.vertices.forEach(function (vertex, i) {
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
            function makeRoughGround(mesh, distortionFr) {
                mesh.geometry.vertices.forEach(function (vertex, i) {
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
        };
        play();
    }
    window.onload = vizInit();
    document.body.addEventListener('touchend', function (ev) { context.resume(); });
    function fractionate(val, minVal, maxVal) {
        return (val - minVal) / (maxVal - minVal);
    }
    function modulate(val, minVal, maxVal, outMin, outMax) {
        var fr = fractionate(val, minVal, maxVal);
        var delta = outMax - outMin;
        return outMin + (fr * delta);
    }
    function avg(arr) {
        var total = arr.reduce(function (sum, b) { return sum + b; });
        return (total / arr.length);
    }
    function max(arr) {
        return arr.reduce(function (a, b) { return Math.max(a, b); })
    }
</script>
