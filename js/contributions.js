import * as THREE from "./three.module.js";
import { GLTFLoader } from './GLTFLoader.js';
import { OrbitControls } from './OrbitControls.js';
import { GUI } from './dat.gui.module.js';
import { STLExporter } from './STLExporter.js';

const BASE_LENGTH = 0.834
const BASE_WIDTH = 0.167
const BASE_HEIGHT = 0.05
const CUBE_SIZE = 0.0143
const MAX_HEIGHT = 0.14
const FACE_ANGLE = 104.79

// sort array ascending
const asc = arr => arr.sort((a, b) => a - b);

const sum = arr => arr.reduce((a, b) => a + b, 0);

const mean = arr => sum(arr) / arr.length;

// sample standard deviation
const std = (arr) => {
    const mu = mean(arr);
    const diffArr = arr.map(a => (a - mu) ** 2);
    return Math.sqrt(sum(diffArr) / (arr.length - 1));
};

const quantile = (arr, q) => {
    const sorted = asc(arr);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

let username = ""
let goal = ""
let apikey = ""

let year = new Date().getFullYear();
let json = {}
let font = undefined
let fontSize = 0.025
let fontHeight = 0.00658 // Extrusion thickness

let camera, scene, renderer
let bronzeMaterial
let controls

var exporter = new STLExporter();

var urlParams = new URLSearchParams(window.location.search);

if (urlParams.has('username')) {
  username = urlParams.get('username')
}

if (urlParams.has('goal')) {
  goal = urlParams.get('goal')
}

if (urlParams.has('apikey')) {
  apikey = urlParams.get('apikey')
}

// Import JSON data

async function loadJSON(username, goal, apikey) {
  // TODO https://json-contributions-five.vercel.app/api/user?username=szymonkorytnicki&year=2022
  // desired data shape:
  let data = {contributions: [
    {
    week: 0,
    days: [
    {
    date: "2022-01-01",
    count: 1,
    }
    ],
    },
    {
    week: 1,
    days: [
    {
    date: "2022-01-02",
    count: 1,
    },
    {
    date: "2022-01-03",
    count: 0,
    },
    {},
    {
    date: "2022-01-05",
    count: 0,
    },
    {
    date: "2022-01-06",
    count: 0,
    },
    {
    date: "2022-01-07",
    count: 1,
    },
    {
    date: "2022-01-08",
    count: 1,
    },
    ],
    },
  ]};
  // what we get:
  // [{"timestamp":1654933191,"value":0.5}]

  let url = `https://www.beeminder.com/api/v1/users/${username}/goals/${goal}/datapoints.json?auth_token=${apikey}&count=500`;
  let response = await fetch(url)
  if (response.ok) {
    const beeminderData = await response.json()
    json = {
      year: new Date().getFullYear(),
      min: 0,
      max: 0,
      median: 0,
      p80: 0,
      p90: 0,
      p99: 5,
      contributions: []
    }

    // TODO get year from URL
    // TODO validate if skyline looks really legit
    beeminderData.forEach(point => {
        const {timestamp, value} = point;
        const date = new Date(timestamp * 1000);
        if (date.getFullYear() !== new Date().getFullYear()) {
          return;
        }

        const week = json.contributions.find(week => week.week === getWeekNumber(date));
        if (!week) {
          json.contributions.push({
            week: getWeekNumber(date),
            days: [
              {
                date: date.toISOString().split('T')[0],
                count: value,
              }
            ]
          })
        } else {
            // has week
            const day = week.days.find(day => day.date === date.toISOString().split('T')[0]);
            if (day) {
              day.count += value;
            } else {
              week.days.push({
                date: date.toISOString().split('T')[0],
                count: value,
              })
            }
        }
    });

    const allCounts = json.contributions.map(week => week.days.map(day => day.count)).flat().filter(x=>x);
  

    json.max = Math.max.apply(null, allCounts);
    json.max = Math.min.apply(null, allCounts);
    json.median = quantile(allCounts, 0.5);
    json.p80 = quantile(allCounts, 0.8);
    json.p90 = quantile(allCounts, 0.8);
    json.p99 = quantile(allCounts, 0.99);
    
    console.log(json, allCounts);
    init()
    animate()
  } else {
    alert("HTTP-Error: " + response.status)
  }
}
function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  // Get first day of year
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  // Return array of year and week number
  return weekNo;
}

loadJSON(username, goal, apikey)

const createText = () => {
  let nameGeo = new THREE.TextGeometry(username, {
    font: font,
    size: fontSize,
    height: fontHeight,
    bevelEnabled: true,

    bevelThickness: 0.0005,
		bevelSize: 0,
		bevelOffset: 0,
		bevelSegments: 10
  })

  let textGroup = new THREE.Group()

  nameGeo.computeBoundingBox()
  nameGeo.computeVertexNormals()

  let yearGeo = new THREE.TextGeometry(year, {
    font: font,
    size: fontSize,
    height: fontHeight,
    bevelEnabled: true,

    bevelThickness: 0.0005,
		bevelSize: 0,
		bevelOffset: 0,
		bevelSegments: 10
    
  })

  nameGeo = new THREE.BufferGeometry().fromGeometry(nameGeo)
  let nameMesh = new THREE.Mesh(nameGeo, bronzeMaterial)

  nameMesh.position.x = -0.295
  nameMesh.position.y = -0.075
  nameMesh.position.z = -0.010

  nameMesh.geometry.rotateX(FACE_ANGLE * Math.PI / 2)
  nameMesh.geometry.rotateY(Math.PI * 2)
  textGroup.add(nameMesh)

  let yearMesh = new THREE.Mesh(yearGeo, bronzeMaterial)

  yearMesh.position.x = 0.280
  yearMesh.position.y = -0.075
  yearMesh.position.z = -0.010

  yearMesh.geometry.rotateX(FACE_ANGLE * Math.PI / 2)
  yearMesh.geometry.rotateY(Math.PI * 2)
  textGroup.add(yearMesh);
  return textGroup;
}

const init = () => {
  // SCENE
  scene = new THREE.Scene()
  scene.background = null;

  // CAMERA
  camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 10 )

  // RENDERER
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: document.querySelector("canvas#three") })
  renderer.setPixelRatio( window.devicePixelRatio )
  renderer.setSize( window.innerWidth, window.innerHeight )
  renderer.outputEncoding = THREE.sRGBEncoding

  // MATERIALS
  // let phongMaterial = new THREE.MeshPhongMaterial( { color: 0xC86033, transparent: true, opacity: 0.2, side: THREE.DoubleSide } )
  bronzeMaterial = new THREE.MeshStandardMaterial( {metalness: 0.99, roughness: 0.5, color: 0xC86033  })

  // LIGHTS
  const dLight1 = new THREE.DirectionalLight(0xdbedff, 0.7)
  dLight1.position.set(2, 0, 2);
  dLight1.target.position.set(0, 0, 0);
  scene.add(dLight1)
  
  const dLight2 = new THREE.DirectionalLight(0xfedbf0, 0.7)
  dLight2.position.set(-2, 0, 2);
  dLight2.target.position.set(0, 0, 0);
  scene.add(dLight2)

  const dLight3 = new THREE.DirectionalLight(0xffffff, 0.7)
  dLight3.position.set(0, 0, -2);
  dLight3.target.position.set(0, 0, 0);
  scene.add(dLight3)

  const dLight4 = new THREE.DirectionalLight(0xffffff, 0.7)
  dLight4.position.set(3, 4, 0);
  dLight4.target.position.set(0, 0, 0);
  scene.add(dLight4)

  // LOAD REFERENCE MODEL
  // let loader = new GLTFLoader().setPath('../models/')
  // loader.load('ashtom-orig.glb', function (gltf) {
  //   gltf.scene.traverse(function (child) {
  //     if (child.isMesh) {
  //       child.material = phongMaterial
  //       child.material.depthWrite = !child.material.transparent
  //     }
  //   })

  //   gltf.scene.rotation.x = Math.PI/2
  //   gltf.scene.rotation.y = -Math.PI

  //   // let worldAxis = new THREE.AxesHelper(2);
  //   // scene.add(worldAxis)
  //   render()
  // })

  // BASE GEOMETRY
  let baseLoader = new GLTFLoader().setPath('../models/')
  baseLoader.load('base.glb', function (base) {
    base.scene.traverse(function (child) {
      if (child.isMesh) {
        child.material = bronzeMaterial
        child.material.depthWrite = !child.material.transparent
      }
    })

    base.scene.rotation.x = -Math.PI/2
    base.scene.rotation.z = -Math.PI


  // USERNAME + YEAR
  let fontLoader = new THREE.FontLoader()
  fontLoader.load('../fonts/helvetiker_regular.typeface.json', function (response) {
    font = response
    let textGroup = createText()

  // CONTRIBUTION BARS
  let barGroup = new THREE.Group()
  let x = 0
  let y = 0
  json.contributions.forEach(week => {
    y = (CUBE_SIZE * 7)
    week.days.forEach(day => {
      y -= CUBE_SIZE
      
      // Adjust height around distribution of values
      // Needed so that a large day doesn't blow out the scale
      let height = (0).toFixed(4)
      if (day.count === json.min)
      {
        height = MAX_HEIGHT * 0.1
      } else if (day.count > json.min && day.count <= json.p99)
      {
        height = ((MAX_HEIGHT * 0.1) + (((MAX_HEIGHT * 0.8) / json.p99) * day.count)).toFixed(4)
      }
      else if (day.count > json.p99)
      {
        height = ((MAX_HEIGHT * 0.9) + (((MAX_HEIGHT * 0.1) / json.max) * day.count)).toFixed(4)
      }

      let geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, height)
      let cube = new THREE.Mesh(geometry, bronzeMaterial)
      cube.position.x = x
      cube.position.y = y
      cube.position.z = BASE_HEIGHT / 2 + height / 2
      barGroup.add(cube)
    })
    x += CUBE_SIZE
  })

  let group = new THREE.Group()
  group.add(base.scene)
  group.add(barGroup)
  group.add(textGroup)

  const groupBox = new THREE.Box3().setFromObject(barGroup)
  const groupCenter = groupBox.getCenter(new THREE.Vector3())
  barGroup.position.x -= groupCenter.x
  barGroup.position.y -= groupCenter.y
  scene.add(group)
  group.rotateX(-Math.PI/2)

  // const plane = new THREE.Mesh(
  //   new THREE.PlaneBufferGeometry( 10000, 10000 ),
  //   new THREE.MeshBasicMaterial( { color: 0xffffff, opacity: 0.8, transparent: true } )
  // );
  // plane.rotation.x = - Math.PI / 2;
  // plane.position.y = -0.04;
  // scene.add(plane)

  // let reflection = group.clone()
  // reflection.applyMatrix(new THREE.Matrix4().makeScale(1, -1, 1));
  // reflection.position.y = -0.1
  // scene.add(reflection)
  
  })


  })

  const box = new THREE.Box3().setFromObject(scene)
  const center = box.getCenter(new THREE.Vector3())

  controls = new OrbitControls(camera, renderer.domElement)
  controls.screenSpacePanning = false;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 2 * 0.9;
  controls.autoRotate = true;
  controls.addEventListener('change', render);
  controls.screenSpacePanning = true
  controls.enableDamping = true
  controls.enableZoom = false
  controls.dampingFactor = 0.1;

  camera.lookAt(center)
  controls.update()

  onWindowResize();

  var buttonExportASCII = document.getElementById( 'exportASCII' );
  buttonExportASCII.addEventListener( 'click', exportASCII );

  var buttonExportBinary = document.getElementById( 'exportBinary' );
  buttonExportBinary.addEventListener( 'click', exportBinary );

  // const axesHelper = new THREE.AxesHelper( 5 );
  // scene.add( axesHelper );

}

const render = () => {
  renderer.render(scene, camera)
}

function animate() {

  requestAnimationFrame( animate );

  controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

  render();

}

function exportASCII() {

  var result = exporter.parse( bronzeMaterial );
  saveString( result, username + '-' + year + '.stl' );

}

function exportBinary() {

  var result = exporter.parse( scene, { binary: true } );
  saveArrayBuffer( result, username + '-' + year + '.stl' );

}

//
// Event listeners
//
const onWindowResize = () => {
  let canvasWidth = window.innerWidth;
  let canvasHeight = window.innerHeight;
  renderer.setSize( canvasWidth, canvasHeight );
  camera.aspect = canvasWidth / canvasHeight;
  let position = Math.min(1000 / canvasWidth, 1000 / canvasHeight);
  camera.position.set(0, position, position)
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', onWindowResize, false)


var link = document.createElement( 'a' );
link.style.display = 'none';
document.body.appendChild( link );

function save( blob, filename ) {

  link.href = URL.createObjectURL( blob );
  link.download = filename;
  link.click();

}

function saveString( text, filename ) {

  save( new Blob( [ text ], { type: 'text/plain' } ), filename );

}

function saveArrayBuffer( buffer, filename ) {

  save( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename );

}
