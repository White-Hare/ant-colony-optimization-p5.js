/// <reference path="../p5.js" />
/// <reference path="./cell.js" />
/// <reference path="./ant.js" />

let EMPTY = 0;
//let ANT = 1; Unused. I never implemented collision.
let FOOD = 2;
let HOME = 3;
let WALL = 4;

let sim;

const sizeMultiplier = 4;
const pixelWidth = 100;
const pixelHeight = 100;

const homeColorHash = "#445533";
const antColorHash = "#00ddaa";
const foodColorHash = "#dd6666";
const bgColorHash = "#eeeeee";
const deadAntColorHash = "#cccccc"


class SimulationVars {
    constructor() {
        this.lifespan = 1500;
        this.sight = 5;
        this.foodPheremoneDecay = 0.99;
        this.homePheremoneDecay = 0.97;
        this.numberOfAnts = 50;
        this.pheremoneColorIntensity = 30;
        
        this.randomDirectionChance = 0.02;

        this.homeRewardOffset = 100;
        this.scorePower = 3;
        this.cornetOffset = 5;

        this.pheremoneIntensityPunishement = 0.70;
        this.pheremoneIntensityReward = 1.1;
    }
}


class Simulation {
    constructor(pg) {
        this.tick = 0;
        this.ants = [];
        this.cells = [];
        this.vars = new SimulationVars();
        this.pg = pg;

        this.homeColor = color(homeColorHash);
        this.antColor = color(antColorHash);
        this.deadAntColor = color(deadAntColorHash);
        this.foodColor = color(foodColorHash);
        this.bgColor = color(bgColorHash);

        this._initializeMap();
    }


    _initializeMap() {
        for (var y = 0; y < this.pg.height; y++) {
            for (var x = 0; x < this.pg.width; x++) {
                let c = new Cell(x, y);
                this.cells.push(c);
            }
        }

        let home = { x: this.vars.cornetOffset, y: this.vars.cornetOffset };
        for (var x = home.x; x <= home.x + 5; x++) {
            for (var y = home.y; y <= home.y + 5; y++) {
                let c = this.getCell(x, y);
                c.type = HOME;
            }
        }

        this.home = this.getCell(home.x, home.y);
        this.home.type = HOME;

        this.foods = [];

        let food = { x: pixelWidth - this.vars.cornetOffset - 5, y: pixelHeight - this.vars.cornetOffset -5 };
        for (var x = food.x; x <= food.x + 5; x++) {
            for (var y = food.y; y <= food.y + 5; y++) {
                let c = this.getCell(x, y);
                c.type = FOOD;
                this.foods.push(c);
            }
        }


        for (var i = 0; i < this.vars.numberOfAnts; i++) {
            this.ants.push(new Ant(this, this.home.x, this.home.y))
        }
    }

    getCell(x, y) {
        if (x < 0 || x >= pixelWidth) {
            return null;
        }
        if (y < 0 || y >= pixelHeight) {
            return null;
        }

        return this.cells[x + y * pixelWidth];
    }

    run() {
        this.tick++;

        for (var i = 0; i < this.ants.length; i++) {
            let a = this.ants[i];
            const c = this.getCell(a.x, a.y);
            if (!c) {
                throw new Error("Cell Not Found\n a = " + JSON.stringify(a));
            }

            if (a.isDead) {
                if (a.shouldRespawn()) {
                    a.respawnAtCell(this.home);
                }
                continue;
            }

            let sensed = a.sensed();
            let fwd = sensed[1];
            let fwdCell = this.getCell(a.x + fwd.x, a.y + fwd.y);

            if (fwdCell === null) {
                a.randomizeDirection();
                continue;
            }

            if (a.carryingFood) {
                //Look for home
                if (fwdCell.type == HOME) {
                    //Drop food
                    a.carryingFood = false;

                    //Reset ttl
                    a.steps = 0;

                    a.turnAround();
                    a.forageForFood();

                } else {
                    a.lookForHome();
                }
            } else {
                //Look for food
                if (fwdCell.type == FOOD) {
                    //Pick up food
                    a.carryingFood = true;
                    a.turnAround();

                    //Reset TTL
                    a.steps = 0;

                    this.clearFood(fwdCell);
                    this.pheremoneIntensity *= this.vars.pheremoneIntensityReward;
                    a.lookForHome();

                } else {
                    a.forageForFood();
                }
            }

            if (!a.isDead && c.type == EMPTY && c.x != a.x && c.y != a.y) {
                if (a.carryingFood) {
                    c.foodPheremone += 1 * a.pheremoneIntensity;
                } else {
                    c.homePheremone += 1 * a.pheremoneIntensity;
                }
            }

            a.steps++;
        }


        for (var i = 0; i < this.cells.length; i++) {
            let c = this.cells[i];
            if (c.foodPheremone > 0) {
                c.foodPheremone *= this.vars.foodPheremoneDecay;
            }
            if (c.homePheremone > 0) {
                c.homePheremone *= this.vars.homePheremoneDecay;
            }
        }

    }

    addFood(x, y) {
        let c = this.getCell(x, y);
        if (c == null) {
            return;
        }
        for (x = c.x - 2; x < c.x + 3; x++) {
            for (y = c.y - 2; y < c.y + 3; y++) {
                let nc = this.getCell(x, y);
                if (nc != null && nc.type == EMPTY) {
                    nc.type = FOOD;
                    this.foods.push(nc);
                }
            }
        }
    }

    clearFood(c) {
        c.type = EMPTY;
        let idx = this.foods.indexOf(c);
        if (idx != -1) {
            this.foods.splice(idx, 1);
        }
    }

    draw() {
        this.pg.background(this.bgColor);
        this.pg.noStroke();



        this._drawPheromoneTrail();


        this.pg.fill(this.foodColor);
        for (var i = 0; i < this.foods.length; i++) {
            let f = this.foods[i];
            this.pg.rect(f.x, f.y, 1, 1);
        }



        for (var i = 0; i < this.ants.length; i++) {
            let a = this.ants[i];
            let antColor;
            if (a.isDead) {
                antColor = this.deadAntColor;
            } else if (a.carryingFood) {
                antColor = this.foodColor;
            } else {
                antColor = this.antColor;
            }
            this.pg.fill(antColor);
            this.pg.rect(a.x, a.y, 2, 2);
        }



        this._scaleAndDrawCanvas()
    }


    _drawPheromoneTrail() {
        //This code draws the pheremone trails.
        //It's pretty but incredibly slow.

        for (var i = 0; i < this.cells.length; i += 1) {
            let c = this.cells[i];
            if (c.type == EMPTY && c.homePheremone > 0 || c.foodPheremone > 0) {
                let pheremoneColor = this.pg.lerpColor(this.foodColor, this.homeColor, (c.homePheremone) / (c.homePheremone + c.foodPheremone));
                let newColor = this.pg.lerpColor(this.bgColor, pheremoneColor, norm(c.homePheremone + c.foodPheremone, 0, 50) * this.vars.pheremoneColorIntensity);
                this.pg.fill(newColor);
                this.pg.rect(c.x, c.y, 1, 1);
            } else if (c.type == FOOD) {
                this.pg.fill(this.foodColor);
                this.pg.rect(c.x, c.y, 1, 1);
            } else if (c.type == HOME) {
                this.pg.fill(this.homeColor);
                this.pg.rect(c.x, c.y, 1, 1);
            }
        }
    }

    _scaleAndDrawCanvas() {
        const img = createImage(this.pg.width, this.pg.height);

        img.loadPixels();
        this.pg.loadPixels();

        for (let y = 0; y < img.height; y++) {
            for (let x = 0; x < img.width; x++) {
                const color = this.pg.get(x, y);
                img.set(x, y, color);
            }
        }

        img.updatePixels();
        img.resize(pixelWidth * sizeMultiplier, pixelHeight * sizeMultiplier);

        image(img, 0, 0, img.width, img.height);
    }
}