import { 
  Scene, 
  PerspectiveCamera, 
  WebGLRenderer, 
  Mesh,
  SphereBufferGeometry,
  MeshStandardMaterial,
  AmbientLight,
  DirectionalLight,
  UnsignedByteType,
  PMREMGenerator,
  TextureLoader,
  Object3D,
  Color,
  Raycaster,
  Vector2
} from 'three';
import { OrbitControls } from './PlanetControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
// import { TextureLoader } from 'three/examples/jsm/loaders/TextureLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples//jsm/postprocessing/UnrealBloomPass.js';
import { makeAtmosMat } from './atmosmat.js'
// import anime from 'animejs/lib/anime.es.js';


export default class AppGame {

  wWidth : number;
  wHeight : number;
  targetDistance : number = 60;
  isClose : boolean = false;

  drag : boolean = false;
  startingPosX : number = 0;
  startingPosY : number = 0;

  scene : Scene;
  camera : PerspectiveCamera;
  renderer : WebGLRenderer;
  composer : EffectComposer;

  controls : OrbitControls;
  pmremGenerator : PMREMGenerator;

  planet : Object3D;
  ray : Raycaster = new Raycaster();
  pointer : Vector2 = new Vector2();

  get aspect (){
    return this.wWidth / this.wHeight;
  }

  constructor() {
    this.wWidth  = window.innerWidth;
    this.wHeight = window.innerHeight;

    // create Scene
    this.scene = new Scene();

    // lights
    const ambientLight = new AmbientLight(0xffffff, 0.1);
    this.scene.add(ambientLight);

    window.sunLight = new THREE.PointLight(new THREE.Color(0xffffff), .2);
    sunLight.position.set(-100, 0, 0);
    this.scene.add(sunLight);

    // create Camera
    this.camera = new PerspectiveCamera(50, this.aspect, 0.1, 1000);
    this.camera.position.z = 130;

    this.renderer = new WebGLRenderer({antialias: true});
    this.renderer.setSize( this.wWidth, this.wHeight );
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1
    document.body.appendChild( this.renderer.domElement );

    // let renderScene = new RenderPass( this.scene, this.camera );

    // let bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 ); //1.5, 0.4, 0.85
    // bloomPass.threshold = 1.9;
    // bloomPass.strength = .5;
    // bloomPass.radius = 1.5;

    // this.composer = new EffectComposer( this.renderer );
    // this.composer.addPass( renderScene );
    // this.composer.addPass( bloomPass );

    // add Events Global
    window.addEventListener( 'resize', this.onWindowResize.bind(this), false);

    // new RGBELoader()
    //   .setDataType( UnsignedByteType )
    new TextureLoader()
      .setPath( 'assets/' )
      .load( 'Milkyway_BG.jpg', ( hdrEquirect ) => {

        var hdrCubeRenderTarget = this.pmremGenerator.fromEquirectangular( hdrEquirect );
        hdrEquirect.dispose();
        this.pmremGenerator.dispose();

        this.scene.background = hdrCubeRenderTarget.texture;
        this.scene.environment = hdrCubeRenderTarget.texture;

      } );

    this.pmremGenerator = new PMREMGenerator( this.renderer );
    this.pmremGenerator.compileEquirectangularShader();
    
    let planetRoot = new Object3D();
    this.scene.add(planetRoot);

    const RADIUS = 10;
    var maps = this.generateTextures();
    this.planet = new SS.planet.Planet(RADIUS, maps.textureMaps, maps.bumpMaps)
    planetRoot.add(this.planet);
    
    var material = makeAtmosMat();
    material.side	= THREE.BackSide;
    material.uniforms.coeficient.value	= 0.4;
    material.uniforms.power.value		= 8.0;
    material.uniforms.glowColor.value	= new Color(0, 1, 1);
    var geometry = new THREE.SphereGeometry(RADIUS * 1.2, 32, 32)
    let mesh = new THREE.Mesh(geometry, material);
    planetRoot.add( mesh );


    this.renderer.domElement.addEventListener('mousedown', (event) => { this.onPointerDown(event) });
    this.renderer.domElement.addEventListener('mousemove', (event) => { this.onPointerMove(event); });
    this.renderer.domElement.addEventListener('mouseup', (event) => { this.onPointerUp(event); });
    
    this.renderer.domElement.addEventListener('touchstart', (event) => { 
      event.pageX = event.touches[ 0 ].pageX;
      event.pageY = event.touches[ 0 ].pageY;
      this.onPointerDown(event) 
    });    
    this.renderer.domElement.addEventListener('touchmove', (event) => { 
      event.pageX = event.touches[ 0 ].pageX;
      event.pageY = event.touches[ 0 ].pageY;
      this.onPointerMove(event); 
    });
    this.renderer.domElement.addEventListener('touchend', (event) => {
      event.pageX = event.changedTouches[ 0 ].pageX;
      event.pageY = event.changedTouches[ 0 ].pageY;
      this.onPointerUp(event); 
    });
    
    this.controls = new OrbitControls( this.camera, this.renderer.domElement );
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    // controls.rotateSpeed = 0.1;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 3.01;
    this.controls.zoomSpeed = 0.5;
    this.controls.enablePan = false;
    this.controls.addEventListener('start', () => {
      this.targetDistance = null;
    })

    this.animate();
  }

  onPointerDown(e) {
    this.drag = false;
    this.startingPosX = e.pageX;
    this.startingPosY = e.pageY;
  }

  onPointerMove(e) {
    if (!(e.pageX === this.startingPosX && e.pageY === this.startingPosY)) {
      this.drag = true
    }
  }
  
  onPointerUp(e) {    
    if(this.drag) return;      
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    this.pointer.x = ( e.pageX / window.innerWidth ) * 2 - 1;
    this.pointer.y = - ( e.pageY / window.innerHeight ) * 2 + 1;

    // update the picking ray with the camera and mouse position
    this.ray.setFromCamera( this.pointer, this.camera );

    // calculate objects intersecting the picking ray
    let intersects = this.ray.intersectObject( this.planet, true );

    if(intersects.length) {
      this.targetDistance = 40;
    }   
  }


  onWindowResize() {
    this.wWidth  = window.innerWidth;
    this.wHeight = window.innerHeight;

    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.wWidth, this.wHeight);
    // this.composer.setSize(this.wWidth, this.wHeight);
  }

  animate() {

    if(this.targetDistance != null) {
      const d = this.camera.position.distanceTo(this.planet.position)
      const dx = d - this.targetDistance;
      if(Math.abs(dx) < .1) {//close enough
        this.controls.update();
      } else if(dx > 0) {
        this.controls.update(Math.max(.99, 1.0-dx/d));
      } else if(dx < 0) {
        this.controls.update(Math.min(1.01, 1.0-dx/d));
      }
    } else {
      this.controls.update();
    }
    

    this.renderer.render(this.scene, this.camera);
    // this.composer.render();

    requestAnimationFrame(this.animate.bind(this));
  }

  
  generateTextures() {
    var textureMaps = [];
    var bumpMaps = [];
    var resolution = 1024;
    
    for (var index = 0; index < 6; index++) {
      var texture = new THREE.WebGLRenderTarget(resolution, resolution, {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat});
      
      var textureCamera = new THREE.OrthographicCamera(-resolution/2, resolution/2, resolution/2, -resolution/2, -100, 100);
      textureCamera.position.z = 10;
      
      var textureScene = new THREE.Scene();
      var plane = new THREE.Mesh(
        new THREE.PlaneGeometry(resolution, resolution), 
        new window.SS.material.textureGeneratorMaterial(index)
      );
      plane.position.z = -10;
      textureScene.add(plane);
      
      this.renderer.setRenderTarget(texture);
      this.renderer.render(textureScene, textureCamera);
      
      var buffer = new Uint8Array(resolution * resolution * 4);
      var gl = this.renderer.getContext();
      gl.readPixels( 0, 0, resolution, resolution, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
      
      textureMaps.push(texture.texture);
      bumpMaps.push({image: {data: buffer, height: resolution, width: resolution}});
      this.renderer.setRenderTarget(null);
    }
    return {textureMaps: textureMaps, bumpMaps: bumpMaps};
  }



}