/** 
 * p2Pixi v0.5.2 - 20-02-2014 
 * Copyright (c) Tom W Hall <tomshalls@gmail.com> 
 * A simple 2D vector game model framework using p2.js for physics and Pixi.js for rendering. 
 * License: MIT 
 */
var P2Pixi;
(function (P2Pixi) {
    'use strict';

    var Game = (function () {

        /**
         * Creates a new Game instance
         */
        function Game(options) {

            options = options || {};

            this.world = new p2.World(options.worldOptions || {});
            this.pixiAdapter = new P2Pixi.PixiAdapter(options.pixiOptions || {});

            this.gameObjects = [];
            this.trackedBody = null;
            this.paused = false;

            if (options.imageUrls) {
                this.loadImages(options.imageUrls);
            } else {
                this.assetsLoaded();
            }
        }

        /**
         * Loads the supplied images asyncronously
         */
        Game.prototype.loadImages = function (imageUrls) {
            var self = this
                , imagesCount = imageUrls.length
                , imagesLoadedCount = 0
                , i
                , imageLoader;

            for (i = 0; i < imagesCount; i++) {
                imageLoader = new PIXI.ImageLoader(imageUrls[i], false);
                imageLoader.addEventListener('loaded', function (e) {
                    imagesLoadedCount++;
                    if (imagesLoadedCount === imagesCount) {
                        self.assetsLoaded();
                    }
                });
                imageLoader.load();
            }
        };

        /**
         * Called before the game loop is started 
         */
        Game.prototype.beforeRun = function () { };

        /**
         * Called when all assets are loaded
         */
        Game.prototype.assetsLoaded = function () {
            this.beforeRun();
            this.run();
        };

        /**
         * Returns the current time in seconds
         */
        Game.prototype.time = function () {
            return new Date().getTime() / 1000;
        };

        /**
         * Begins the world step / render loop
         */
        Game.prototype.run = function () {
            var self = this
                , lastCallTime = self.time()
                , maxSubSteps = 10;

            function update() {
                var timeSinceLastCall;

                if (!self.paused) {
                    timeSinceLastCall = self.time() - lastCallTime;
                    lastCallTime = self.time();
                    self.world.step(1 / 60, timeSinceLastCall, maxSubSteps);
                }

                self.render();
                requestAnimationFrame(update);
            }

            requestAnimationFrame(update);
        };

        /**
         * Updates the Pixi representation of the world
         */
        Game.prototype.render = function () {
            var pixiAdapter = this.pixiAdapter
                , w = pixiAdapter.renderer.width
                , h = pixiAdapter.renderer.height
                , ppu = pixiAdapter.pixelsPerLengthUnit
                , gameObjects = this.gameObjects
                , gameObjectCount = gameObjects.length
                , gameObject
                , gameObjectBodyCount
                , i
                , j
                , body
                , displayObjectContainer
                , trackedBody = this.trackedBody
                , trackedBodyPosition;

            for (i = 0; i < gameObjectCount; i++) {
                gameObject = gameObjects[i];
                gameObjectBodyCount = gameObject.bodies.length;

                // Update DisplayObjectContainer transforms
                for (j = 0; j < gameObjectBodyCount; j++) {
                    body = gameObject.bodies[j];
                    displayObjectContainer = gameObject.displayObjectContainers[j];

                    displayObjectContainer.position.x = body.position[0] * ppu;
                    displayObjectContainer.position.y = h - body.position[1] * ppu;
                    displayObjectContainer.rotation = -body.angle;
                }
            }

            // Scroll viewport to track focused body if set
            if (trackedBody !== null) {
                trackedBodyPosition = trackedBody.position;
                pixiAdapter.stage.position.x = (pixiAdapter.renderer.width / 2) - (trackedBodyPosition[0] * ppu);
                pixiAdapter.stage.position.y = -(pixiAdapter.renderer.height / 2) + (trackedBodyPosition[1] * ppu);
            }

            pixiAdapter.renderer.render(pixiAdapter.container);
        }

        return Game;
    })();

    P2Pixi.Game = Game;
})(P2Pixi || (P2Pixi = {}));
;var P2Pixi;
(function (P2Pixi) {
    'use strict';

    var GameObject = (function () {

        /**
         * Creates a new GameObject instance
         * @param  {Game} game
         */
        function GameObject(game) {
            this.game = game;

            this.bodies = []; // p2 physics bodies
            this.displayObjectContainers = []; // Pixi DisplayObjectContainers, one for each body. Each contains a child array of Graphics and / or Sprites.

            game.gameObjects.push(this);
        }

        /**
         * Adds the supplied p2 body to the game's world and creates a corresponding null DisplayObjectContainer object for rendering
         * @param  {Body} body
         * @return {GameObject} gameObject
         */
        GameObject.prototype.addBody = function (body) {
            this.bodies.push(body);
            this.displayObjectContainers.push(null);

            this.game.world.addBody(body);

            return this;
        };

        /**
         * Adds the supplied p2 shape to the supplied p2 body
         * @param  {Body} body
         * @param  {Shape} shape
         * @param  {Vector} offset
         * @param  {Number} angle
         * @param  {Object} options
         * @param  {Object} style
         * @param  {Texture} texture
         * @param  {Number} alpha
         * @return {GameObject} gameObject
         */
        GameObject.prototype.addShape = function (body, shape, offset, angle, options, style, texture, alpha) {
            var displayObjectContainer
                , displayObject
                , graphics
                , i;

            offset = offset || [0, 0];
            angle = angle || 0;

            options = options || {};
            shape.collisionGroup = options.collisionGroup || 1;
            shape.collisionMask = options.collisionMask || 1;

            body.addShape(shape, offset, angle);

            displayObjectContainer = this.displayObjectContainers[this.bodies.indexOf(body)];
            if (displayObjectContainer === null) {
                displayObjectContainer = new PIXI.DisplayObjectContainer();
                this.displayObjectContainers[this.bodies.indexOf(body)] = displayObjectContainer;
                this.game.pixiAdapter.stage.addChild(displayObjectContainer);
            }

            this.game.pixiAdapter.addShape(displayObjectContainer
                , shape
                , offset
                , angle
                , style
                , texture
                , alpha);

            return this;
        }

        /**
         * Returns the current time in seconds
         */
        GameObject.prototype.time = function () {
            return new Date().getTime() / 1000;
        };

        return GameObject;
    })();

    P2Pixi.GameObject = GameObject;
})(P2Pixi || (P2Pixi = {}));
;var P2Pixi;
(function (P2Pixi) {
    'use strict';

    var PixiAdapter = (function () {

        var vec2 = p2.vec2
            , Body = p2.Body
            , Circle = p2.Circle
            , Capsule = p2.Capsule
            , Convex = p2.Convex
            , Plane = p2.Plane
            , Rectangle = p2.Rectangle
            , Particle = p2.Particle
            , Line = p2.Line
            , EventEmitter = p2.EventEmitter
            , init_stagePosition = vec2.create()
            , init_physicsPosition = vec2.create();

        /**
         * Creates a new PixiAdapter instance
         */
        function PixiAdapter(options) {

            var self = this
                , key;

            options = options || {};

            var settings = {
                pixelsPerLengthUnit: 128
                , width: 1280 // Pixi screen resolution
                , height: 720
                , useDeviceAspect: true
            };

            for (key in options) {
                settings[key] = options[key];
            }

            if (settings.useDeviceAspect) {
                settings.height = getWindowHeight() / getWindowWidth() * settings.width;
            }

            this.settings = settings;
            var ppu = this.pixelsPerLengthUnit = settings.pixelsPerLengthUnit;

            EventEmitter.call(this);

            this.renderer = PIXI.autoDetectRenderer(this.settings.width, this.settings.height, this.settings.viewport, this.settings.transparent, true);

            this.stage = new PIXI.DisplayObjectContainer();
            this.container = new PIXI.Stage(0xFFFFFF, true);
            this.container.addChild(this.stage);

            this.renderer.view.style.position = 'absolute';
            document.body.appendChild(this.renderer.view);

            // Center the stage at origin
            this.stage.position.x = this.renderer.width / 2;
            this.stage.position.y = -this.renderer.height / 2;

            this.windowWidth = getWindowWidth();
            this.windowHeight = getWindowHeight();
            this.resize(this.windowWidth, this.windowHeight);

            window.addEventListener('resize', resizeRenderer);
            window.addEventListener('orientationchange', resizeRenderer);

            function getWindowWidth() {
                return window.innerWidth || document.documentElement.clientWidth;
            }

            function getWindowHeight() {
                return window.innerHeight || document.documentElement.clientHeight;
            }

            function resizeRenderer() {
                self.resize(getWindowWidth(), getWindowHeight());
            }
        }

        PixiAdapter.prototype = new EventEmitter();

        /**
         * Draws a circle onto a PIXI.Graphics object
         * @param  {PIXI.Graphics} g
         * @param  {Number} x
         * @param  {Number} y
         * @param  {Number} radius
         * @param  {object} style
         */
        PixiAdapter.prototype.drawCircle = function (graphics, x, y, radius, style) {
            style = style || {};
            var lineWidth = style.lineWidth || 0
                , lineColor = style.lineColor || 0x000000
                , fillColor = style.fillColor;

            graphics.lineStyle(lineWidth, lineColor, 1);

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            graphics.drawCircle(x, y, radius);

            if (fillColor) {
                graphics.endFill();
            }
        };

        /**
         * Draws a finite plane onto a PIXI.Graphics object
         * @param  {Graphics} graphics
         * @param  {Number} x0
         * @param  {Number} x1
         * @param  {Number} color
         * @param  {object} style
         */
        PixiAdapter.prototype.drawPlane = function (graphics, x0, x1, color, style) {
            style = style || {};
            var max = 1e6
                , lineWidth = style.lineWidth || 0
                , lineColor = style.lineColor || 0x000000
                , fillColor = style.fillColor;

            graphics.lineStyle(lineWidth, lineColor, 1);

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            graphics.moveTo(-max, 0);
            graphics.lineTo(max, 0);
            graphics.lineTo(max, max);
            graphics.lineTo(-max, max);

            if (fillColor) {
                graphics.endFill();
            }

            // Draw the actual plane
            graphics.lineStyle(lineWidth, lineColor);
            graphics.moveTo(-max, 0);
            graphics.lineTo(max, 0);
        };

        /**
         * Draws a line onto a PIXI.Graphics object
         * @param  {Graphics} graphics
         * @param  {Number} len
         * @param  {object} style
         */
        PixiAdapter.prototype.drawLine = function (graphics, len, style) {
            style = style || {};
            var lineWidth = style.lineWidth || 1
                , lineColor = style.lineColor || 0x000000;

            graphics.lineStyle(lineWidth, lineColor, opacity);

            graphics.moveTo(-len / 2, 0);
            graphics.lineTo(len / 2, 0);
        };

        /**
         * Draws a capsule onto a PIXI.Graphics object
         * @param  {Graphics} graphics
         * @param  {Number} x
         * @param  {Number} y
         * @param  {Number} angle
         * @param  {Number} len
         * @param  {Number} radius
         * @param  {object} style
         */
        PixiAdapter.prototype.drawCapsule = function (graphics, x, y, angle, len, radius, style) {
            style = style || {};
            var c = Math.cos(angle)
                , s = Math.sin(angle)
                , lineWidth = style.lineWidth || 0
                , lineColor = style.lineColor || 0x000000
                , fillColor = style.fillColor;

            graphics.lineStyle(lineWidth, lineColor, 1);


            // Draw circles at ends

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            graphics.drawCircle(-len / 2 * c + x, -len / 2 * s + y, radius);
            graphics.drawCircle(len / 2 * c + x, len / 2 * s + y, radius);

            if (fillColor) {
                graphics.endFill();
            }


            // Draw rectangle

            graphics.lineStyle(lineWidth, lineColor, 0);

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            graphics.moveTo(-len / 2 * c + radius * s + x, -len / 2 * s + radius * c + y);
            graphics.lineTo(len / 2 * c + radius * s + x, len / 2 * s + radius * c + y);
            graphics.lineTo(len / 2 * c - radius * s + x, len / 2 * s - radius * c + y);
            graphics.lineTo(-len / 2 * c - radius * s + x, -len / 2 * s - radius * c + y);

            if (fillColor) {
                graphics.endFill();
            }


            // Draw lines in between

            graphics.lineStyle(lineWidth, lineColor, 1);
            graphics.moveTo(-len / 2 * c + radius * s + x, -len / 2 * s + radius * c + y);
            graphics.lineTo(len / 2 * c + radius * s + x, len / 2 * s + radius * c + y);
            graphics.moveTo(-len / 2 * c - radius * s + x, -len / 2 * s - radius * c + y);
            graphics.lineTo(len / 2 * c - radius * s + x, len / 2 * s - radius * c + y);
        };

        /**
         * Draws a rectangle onto a PIXI.Graphics object
         * @param  {Graphics} graphics
         * @param  {Number} x
         * @param  {Number} y
         * @param  {Number} w
         * @param  {Number} h
         * @param  {object} style
         */
        PixiAdapter.prototype.drawRectangle = function (graphics, x, y, w, h, style) {
            style = style || {};
            var lineWidth = style.lineWidth || 0
                , lineColor = style.lineColor || 0x000000
                , fillColor = style.fillColor;

            graphics.lineStyle(lineWidth, lineColor, 1);

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            graphics.drawRect(x - w / 2, y - h / 2, w, h);

            if (fillColor) {
                graphics.endFill();
            }
        };

        /**
         * Draws a convex polygon onto a PIXI.Graphics object
         * @param  {Graphics} graphics
         * @param  {Array} verts
         * @param  {object} style
         */
        PixiAdapter.prototype.drawConvex = function (graphics, verts, style) {
            style = style || {};
            var lineWidth = style.lineWidth || 0
                , lineColor = style.lineColor || 0x000000
                , fillColor = style.fillColor;

            graphics.lineStyle(lineWidth, lineColor, 1);

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            for (var i = 0; i !== verts.length; i++) {
                var v = verts[i],
                    x = v[0],
                    y = v[1];
                if (i == 0) {
                    graphics.moveTo(x, y);
                } else {
                    graphics.lineTo(x, y);
                }
            }

            if (fillColor) {
                graphics.endFill();
            }

            if (verts.length > 2) {
                graphics.moveTo(verts[verts.length - 1][0], verts[verts.length - 1][1]);
                graphics.lineTo(verts[0][0], verts[0][1]);
            }
        };

        /**
         * Draws a path onto a PIXI.Graphics object
         * @param  {Graphics} graphics
         * @param  {Array} path
         * @param  {object} style
         */
        PixiAdapter.prototype.drawPath = function (graphics, path, style) {
            style = style || {};

            var lineWidth = style.lineWidth || 0
                , lineColor = style.lineColor || 0x000000
                , fillColor = style.fillColor;

            graphics.lineStyle(lineWidth, lineColor, 1);

            if (fillColor) {
                graphics.beginFill(fillColor, 1);
            }

            var lastx = null,
                lasty = null;

            for (var i = 0; i < path.length; i++) {
                var v = path[i],
                    x = v[0],
                    y = v[1];

                if (x != lastx || y != lasty) {
                    if (i == 0) {
                        graphics.moveTo(x, y);
                    } else {
                        // Check if the lines are parallel
                        var p1x = lastx,
                            p1y = lasty,
                            p2x = x,
                            p2y = y,
                            p3x = path[(i + 1) % path.length][0],
                            p3y = path[(i + 1) % path.length][1];
                        var area = ((p2x - p1x) * (p3y - p1y)) - ((p3x - p1x) * (p2y - p1y));
                        if (area != 0)
                            graphics.lineTo(x, y);
                    }

                    lastx = x;
                    lasty = y;
                }
            }

            if (fillColor) {
                graphics.endFill();
            }

            // Close the path
            if (path.length > 2 && style.fillColor) {
                graphics.moveTo(path[path.length - 1][0], path[path.length - 1][1]);
                graphics.lineTo(path[0][0], path[0][1]);
            }
        };

        /**
         * Renders the supplied p2 Shape onto the supplied Pixi Graphics object using the supplied Pixi style properties
         * @param  {Graphics} graphics
         * @param  {Shape} shape
         * @param  {Vector} offset
         * @param  {Number} angle
         * @param  {Object} style
         */
        PixiAdapter.prototype.renderShapeToGraphics = function (graphics, shape, offset, angle, style) {
            var zero = [0, 0]
                , ppu = this.pixelsPerLengthUnit
                , verts
                , vrot
                , i
                , v;

            offset = offset || zero;
            angle = angle || 0;

            if (shape instanceof Circle) {
                this.drawCircle(graphics, offset[0] * ppu, -offset[1] * ppu, shape.radius * ppu, style);

            } else if (shape instanceof Particle) {
                this.drawCircle(graphics, offset[0] * ppu, -offset[1] * ppu, 2 * lw, style);

            } else if (shape instanceof Plane) {
                // TODO: use shape angle
                this.drawPlane(graphics, -10 * ppu, 10 * ppu, style);

            } else if (shape instanceof Line) {
                this.drawLine(graphics, child.length * ppu, style);

            } else if (shape instanceof Rectangle) {
                this.drawRectangle(graphics, offset[0] * ppu, -offset[1] * ppu, shape.width * ppu, shape.height * ppu, style);

            } else if (shape instanceof Capsule) {
                this.drawCapsule(graphics, offset[0] * ppu, -offset[1] * ppu, angle, shape.length * ppu, shape.radius * ppu, style);

            } else if (shape instanceof Convex) {
                // Scale verts
                verts = [];
                vrot = vec2.create();

                for (i = 0; i < shape.vertices.length; i++) {
                    v = shape.vertices[i];
                    vec2.rotate(vrot, v, angle);
                    verts.push([(vrot[0] + offset[0]) * ppu, -(vrot[1] + offset[1]) * ppu]);
                }

                this.drawConvex(graphics, verts, style);
            }
        }

        /**
         * Adds the supplied shape to the supplied DisplayObjectContainer, using vectors and / or a texture
         * @param  {DisplayObjectContainer} displayObjectContainer
         * @param  {Shape} shape
         * @param  {Vector} offset
         * @param  {Number} angle
         * @param  {Object} style
         * @param  {Texture} texture
         * @param  {Number} alpha
         */
        PixiAdapter.prototype.addShape = function (displayObjectContainer, shape, offset, angle, style, texture, alpha) {

            var zero = [0, 0]
                , graphics
                , tilingSprite
                , doc
                , ppu = this.pixelsPerLengthUnit
                , aabb
                , width
                , height
                , left 
                , top
                , right
                , bottom
                , maskGraphics;

            // If a Pixi texture has been specified...
            if (texture) {
                // Calculate the bounding box of the shape when at zero offset and 0 angle
                aabb = new p2.AABB();
                shape.computeAABB(aabb, zero, 0);

                // Get world coordinates of shape boundaries
                left = aabb.lowerBound[0];
                bottom = aabb.lowerBound[1];
                right = aabb.upperBound[0];
                top = aabb.upperBound[1];

                width = right - left;
                height = top - bottom;

                // Create a TilingSprite to cover the entire shape
                tilingSprite = new PIXI.TilingSprite(texture, width * ppu, height * ppu);
                tilingSprite.alpha = alpha || 1;

                // If the shape is anything other than a rectangle, we need a mask for the texture.
                // We use the shape itself to create a new Graphics object.
                if (!(shape instanceof Rectangle)) {
                    maskGraphics = new PIXI.Graphics();
                    maskGraphics.renderable = false;
                    maskGraphics.position.x = (offset[0] * ppu);
                    maskGraphics.position.y = -(offset[1] * ppu);
                    maskGraphics.rotation = -angle;

                    this.renderShapeToGraphics(maskGraphics
                        , shape
                        , zero
                        , 0
                        , { lineWidth: 0, fillColor: 0xffffff });

                    displayObjectContainer.addChild(maskGraphics);
                    tilingSprite.mask = maskGraphics;
                }

                // Sprite positions are the top-left corner of the Sprite, whereas Graphics objects
                // are positioned at their origin
                if (angle === 0) {
                    tilingSprite.position.x = (left * ppu) + (offset[0] * ppu);
                    tilingSprite.position.y = -(top * ppu) - (offset[1] * ppu);
                    tilingSprite.rotation = -angle;

                    displayObjectContainer.addChild(tilingSprite);
                } else {
                    tilingSprite.position.x = (left * ppu);
                    tilingSprite.position.y = -(top * ppu);

                    doc = new PIXI.DisplayObjectContainer();
                    doc.addChild(tilingSprite);
                    doc.position.x = (offset[0] * ppu);
                    doc.position.y = -(offset[1] * ppu);
                    doc.rotation = -angle;

                    doc.addChild(tilingSprite);
                    displayObjectContainer.addChild(doc);
                }
            }

            // If any Pixi vector styles have been specified...
            if (style) {
                graphics = new PIXI.Graphics();
                graphics.alpha = alpha || 1;
                graphics.position.x = (offset[0] * ppu);
                graphics.position.y = -(offset[1] * ppu);
                graphics.rotation = -angle;

                this.renderShapeToGraphics(graphics
                    , shape
                    , zero
                    , 0
                    , style);

                displayObjectContainer.addChild(graphics);
            }
        }

        /**
         * Resizes the Pixi renderer's view to fit proportionally in the supplied window dimensions
         * @param  {Number} w
         * @param  {Number} h
         */
        PixiAdapter.prototype.resize = function (w, h) {
            this.windowWidth = w;
            this.windowHeight = h;

            var renderer = this.renderer
                , view = renderer.view
                , ratio = w / h
                , pixiRatio = renderer.width / renderer.height;

            if (ratio > pixiRatio) { // Screen is wider than the renderer

                view.style.height = h + 'px';
                view.style.width = (h * pixiRatio) + 'px';
                view.style.left = ((w - h * pixiRatio) / 2) + 'px';

            } else { // Screen is narrower

                view.style.height = (w / pixiRatio) + 'px';
                view.style.width = w + 'px';
                view.style.top = ((h - w / pixiRatio) / 2) + 'px';

            }
        };

        return PixiAdapter;
    })();

    P2Pixi.PixiAdapter = PixiAdapter;
})(P2Pixi || (P2Pixi = {}));