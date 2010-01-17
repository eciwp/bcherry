/*jslint white: true, onevar: true, browser: true, devel: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, strict: false, newcap: true, immed: true */
/*globals JB: false, TI: false, window: false, SimpleThread: false, jQuery: false, consul: false	 */
(function (window) {
	// Data Imports
	var	Data = JB.Data,
		Sprites = JB.Data.Sprites,
		Blocks = JB.Data.Blocks,
		
	// Functions in this module
		buildGame,
		buildMap,
		buildJet,
		
	// Global config stuff
		calcSpec = {
			model	: "ti89",
			width	: 160 * 3,
			height	: 100 * 3,
			gfxMode	: "grayscale"
		},
	
	// mungable aliases
		$ = window.jQuery,
		
	// The game (duh!)
		game;
		
	buildGame = function buildGame(spec) {
		var	that,
		
		// Functions in this module
			start,
			play,
			pause,
			stop,
			main,
			keyListeners,
			scroll,
			draw,
			doShots,
			checkDeath,
			
		// Calc API
			calc = TI.makeCalculator(spec.calcSpec),
			
		// Game data
			map = buildMap({width: 160, height: 12}),
			jet = buildJet({map: map}),
			shots = [],
			screen = {x: -100, y: 0},
			
		// Control vars
			thread,
			scrollInterval,
			started = false,
			frame = 0;
		
		that = {};
		
		// Control methods
		start = that.start = function start() {
			if (started) {
				return false;
			}
			started = true;
			
			// Load the display
			document.body.appendChild(calc.display.getDomElement()); // FIXME: should pass in dom location in spec
			
			
			// Set up key listeners
			keyListeners();
			
			// Set up the game thread, and start the game
			thread = new SimpleThread(main, {autoStart: false});
			that.play();
		};
		
		play = that.play = function play() {
			if (thread.isRunning()) {
				return;
			}
			thread.start();
			scrollInterval = setInterval(scroll, 20);
		};
		
		pause = that.pause = function pause() {
			if (!thread.isRunning()) {
				return;
			}
			thread.stop();
			clearInterval(scrollInterval);
		};
		
		stop = that.stop = function stop() {
			thread.stop();
			clearInterval(scrollInterval);
			consul.log("dead");
		};
		
		// Game methods
		main = function main() {
			draw();
			doShots();
			checkDeath();
			frame = (frame + 1) % 120;
		};
		
		keyListeners = function keyListeners() {
			// TODO: Clean these up (seriously!)
			calc.keys.listen("up", function () {
				jet.moveUp();
			});
			calc.keys.listen("down", function () {
				jet.moveDown();
			});
			calc.keys.listen("left", function () {
				jet.moveLeft();
			});
			calc.keys.listen("right", function () {
				jet.moveRight();
			});
			calc.keys.listen("2nd", function () {
				shots.push(jet.fire());
			});
		};
		
		scroll = function scroll() {
			screen.x = screen.x + 1;
		};
		
		draw = function draw() {
			var	i,
				shot,
				jetSprite,
				len = shots.length;
			
			calc.display.clear();
			
			map.drawTo(calc.display, screen, (frame % 12) === 0, (frame % 6) === 0);
			
			jet.drawTo(calc.display, calc.keys, frame);
			
			for (i = 0; i < len; i += 1) {
				shot = shots[i];
				calc.display.drawSprite(Sprites.cannon.p1, Sprites.cannon.p2, Sprites.cannon.width, shot.x, shot.y);
			}
		};
		
		doShots = function doShots() {
			var i,
				j,
				shot,
				collisions,
				clearShot,
				len = shots.length;
			
			// When we want to pull out a shot, we need to adjust our loop iterators
			clearShot = function clearShot() {
				shots.splice(i, 1);
				i -= 1;
				len -= 1;
			};
				
			for (i = 0; i < len; i += 1) {
				shot = shots[i];
				shot.x = shot.x + 4;
				
				
				// Once they've run off the map we can get rid of them
				if (map.outOfBounds(shot.x + screen.x, shot.y + screen.y, 8, 8, "right")) {
					clearShot();
					continue;
				}
				
				collisions = map.collision(shot.x + screen.x, shot.y + screen.y, 8, 8);
				if (collisions.length > 0) {
					for (j = 0; j < collisions.length; j = j + 1) {
						map.damage(collisions[j], shot.strength);
					}
					clearShot();
				}
			}
		};
		
		checkDeath = function checkDeath() {
			var collisions = map.collision(jet.x + screen.x, jet.y + screen.y, 16, 8);
			
			if (collisions.length > 0) {
				that.stop();
			}
		};
		
		return that;
	};
	
	buildJet = function buildJet(my) {
		var that = {},
			map = my.map;
		
		that.fire = function fire(type) {
			//TODO: Shot types
			var shot = {
				x: that.x + 16,
				y: that.y,
				strength: that.cannonStrength
			};
			
			return shot;
		};
		
		// Movement functions
		that.moveUp = function moveUp() {
			that.y -= 2;
		};
		that.moveDown = function moveDown() {
			that.y += 2;
		};
		that.moveLeft = function moveLeft() {
			that.x -= 2;
		};
		that.moveRight = function moveRight() {
			that.x += 2;
		};
		
		that.drawTo = function drawTo(display, keys, frame) {
			var sprite = Sprites.jetReg;
			if (keys.isPressed("down")) {
				sprite = Sprites.jetDown;
			} else if (keys.isPressed("up")) {
				sprite = Sprites.jetUp;
			}
			
			display.drawSprite(sprite.p1, sprite.p2, sprite.width, that.x, that.y);
			
			frame = frame % 24;
			if (frame < 8) {
				sprite = Sprites.regExhaust1;
			} else if (frame < 16) {
				sprite = Sprites.regExhaust2;
			} else {
				sprite = Sprites.regExhaust3;
			}
			display.drawSprite(sprite.p1, sprite.p2, sprite.width, that.x - sprite.width, that.y);
		};
		
		// Initialize our location
		that.x = 0;
		that.y = 0;
		
		// Stats
		that.cannonStrength = 1;
		
		return that;
	};
	
	buildMap = function buildMap(spec) {
		var that,
			
		// Functions in this module
			drawTo,
			collision,
			damage,
			outOfBounds,
			isMine,
			isRegular,
			isExplosion,
		
		// Config values
			width = spec.width,
			height = spec.height,
			
		// Local data
			map = Array.matrix(width, height, 0),
			proportions = { // TODO: take these as parameter
				none			: 80,
				regular			: 90,
				indestructible	: 92,
				mine			: 100
			},
			
		// Loop iterators
			col,
			row,
			i,
			a;
		
		that = {};
		that.width = width;
		that.height = height;
		
		// Populate our map
		for (col = 0; col < 160; col += 1) {
			for (row = 0; row < 12; row += 1) {
				i = Math.randInt(100);
				a = map[col];
				if (i > proportions.none) {
					if (i < proportions.regular) {
						a[row] = Blocks.regular;
					} else if (i < proportions.indestructible) {
						a[row] = Blocks.indestructible;
					} else {
						a[row] = Blocks.mine1;
					}
				}
			}
		}
		
		drawTo = that.drawTo = function drawTo(display, offset, rotate, explode) {
			var col,
				row,
				i,
				j,
				c,
				a,
				block,
				sprite,
				x,
				y,
				mapWidth = width,
				mapHeight = height,
				displayWidth = display.width;
			
			for (col = 0; col < mapWidth; col += 1) {
				if (col * 8 + 7 < offset.x || col * 8 > offset.x + displayWidth) {
					continue;
				}
				
				a = map[col];
				for (row = 0; row < mapHeight; row += 1) {
					block = a[row];
					if (block !== Blocks.none) {
						sprite = Blocks.Sprites[block];
						x = col * 8;
						y = row * 8;
						if (sprite.width === 16) {
							x -= 4;
							y -= 4;
						}
						display.drawSprite(sprite.p1, sprite.p2, sprite.width, x - offset.x, y - offset.y);
						
						// If it's a mine, rotate it
						if (rotate && isMine(block)) {
							block -= 1;
							if (block < Blocks.mine1) {
								block = Blocks.mine3;
							}
							a[row] = block;
						} else if (explode && isExplosion(block)) {
							block -= 1;
							if (block < Blocks.mineExplosion4) {
								block = 0;
							} else if (block === Blocks.mineExplosion3) {
								for (i = col - 1; i <= col + 1; i += 1) {
									if (i >= 0 && i < mapWidth) {
										c = map[i];
										for (j = row - 1; j <= row + 1; j += 1) {
											if (j >= 0 && j < mapHeight) {
												damage({col: i, row: j}, 5);
											}
										}
									}
								}
							}
							a[row] = block;
						}
					}
				}
			}
		};
		
		// TODO: I think this function needs to be optimized
		collision = that.collision = function collision(x, y, w, h) {
			var firstCol = (x / 8).floor(),
				lastCol = ((x + w - 1) / 8).floor(),
				firstRow = (y / 8).floor(),
				lastRow = ((y + h - 1) / 8).floor(),
				
				collisions = [],
				col,
				row,
				block,
				a,
				mapWidth = width,
				mapHeight = height;
			
			for (col = firstCol; col <= lastCol; col = col + 1) {
				if (col < 0 || col >= mapWidth) {
					continue;
				}
				
				a = map[col];
				for (row = firstRow; row <= lastRow; row = row + 1) {
					if (row < 0 || row >= mapHeight) {
						continue;
					}
					block = a[row];
					if (block > 0 && block < Blocks.mineExplosion4) {
						collisions.push({
							col: col,
							row: row
						});
					}
				}
			}
			return collisions;
		};
		
		outOfBounds = that.outOfBounds = function outOfBounds(x, y, w, h, dirs) {
			var firstCol = (x / 8).floor(),
				lastCol = ((x + w - 1) / 8).floor(),
				firstRow = (y / 8).floor(),
				lastRow = ((y + h - 1) / 8).floor(),
				checkLeft,
				checkRight,
				checkUp,
				checkDown;
			
			dirs = dirs || "all";
			
			// TODO: let dirs be an array
			checkLeft = dirs === "all" || dirs === "x" || dirs === "left";
			checkRight = dirs === "all" || dirs === "x" || dirs === "right";
			checkUp = dirs === "all" || dirs === "y" || dirs === "up";
			checkDown = dirs === "all" || dirs === "y" || dirs === "down";
			
			return (checkLeft && lastCol < 0) || (checkRight && firstCol >= map.width) || (checkUp && lastRow < 0) || (checkDown && firstRow >= map.height);
		};
		
		damage = that.damage = function damage(block, strength) {
			var b = map[block.col][block.row],
				newblock = b;
			if (isRegular(b)) {
				newblock = b - strength;
			} else if (b === Blocks.indestructible) {
				if (strength >= 4) {
					newblock = b - strength + 1;
				}
			} else if (isMine(b)) {
				newblock = Blocks.mineExplosion1;
			}
			
			if (newblock < 0) {
				newblock = 0;
			}
			map[block.col][block.row] = newblock;
		};
		
		isMine = function isMine(block) {
			return block >= Blocks.mine1 && block <= Blocks.mine3;
		};
		
		// OPTIMIZATION: changing the order of the comparisons here could produce good savings
		isRegular = function isRegular(block) {
			return block >= Blocks.broken2 && block <= Blocks.regular;
		};
		
		isExplosion = function isExplosion(block) {
			return block >= Blocks.mineExplosion4 && block <= Blocks.mineExplosion1;
		};
		
		return that;
	};
	
	game = JB.game = buildGame({
		calcSpec: calcSpec
	});
	$(game.start);
}(window));
