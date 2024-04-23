/// <reference path="./simulation.js"/>

class Ant {
  constructor(sim, x, y) {
    this.simulation = sim;
    this.x = x;
    this.y = y;
    this.steps = 0;
    //Angles are in increments of 45 degrees, clockwise, with 0 = north
    this.angle = 0;
    this.carryingFood = false;

    this.directions = [
      { x: 0, y: -1 }, //N
      { x: 1, y: -1 }, //NE
      { x: 1, y: 0 }, //E
      { x: 1, y: 1 }, //SE
      { x: 0, y: 1 }, //S
      { x: -1, y: 1 }, //SW
      { x: -1, y: 0 }, //W,
      { x: -1, y: -1 } //NW
    ];

    this.pheremoneIntensity = 1;
  }

  get lifespan() {
    return max(this.simulation.vars.lifespan, 1);
  }


  get isDead() {
    const r = this.steps > this.lifespan;
    if(r){
      this.pheremoneIntensity *= this.simulation.vars.pheremoneIntensityPunishement;
      this.pheremoneIntensity = Math.max(this.pheremoneIntensity, 1);
    }
    return r;
  }

  respawnAtCell(c) {
    this.x = c.x;
    this.y = c.y;
    this.randomizeDirection();
    this.steps = 0;
  }

  shouldRespawn() {
    return random(0, 1000) < 5;
  }

  turnLeft() {
    this.angle -= 1;
    if (this.angle < 0) {
      this.angle = this.directions.length - 1;
    }
  }

  turnRight() {
    this.angle += 1;
    this.angle = this.angle % this.directions.length;
  }

  turnAround() {
    for (let i = 0; i < 4; i++) {
      this.turnRight();
    }
  }


  forward() {
    let fwd = this.directions[this.angle];
    return fwd;
  }

  sensed() {
    let fwd = this.forward();
    let i = 0;
    for (; i < this.directions.length; i++) {
      if (this.directions[i] == fwd) {
        break;
      }
    }


    let fwdLeft = this.directions[i > 0 ? i - 1 : this.directions.length - 1];
    let fwdRight = this.directions[(i + 1) % this.directions.length];

    return [fwdLeft, fwd, fwdRight];
  }

  walkRandomly() {
    let [fwdLeft, fwd, fwdRight] = this.sensed();

    let action = floor(random(0, 6));
    //Slightly more likely to move forwards than to turn

    let [fwdX, fwdY] = [0, 0];

    if (action < 4) {
      fwdX = fwd.x;
      fwdY = fwd.y;
    } else if (action == 4) {
      this.turnLeft();
      fwdX = fwdLeft.x;
      fwdY = fwdLeft.y;
    } else if (action == 5) {
      this.turnRight();
      fwdX = fwdRight.x;
      fwdY = fwdRight.y;
    }

    this.move(fwdX, fwdY)
  }

  move(dx, dy) {
    if (this.simulation.getCell(this.x + dx, this.y + dy)) {
      this.x += dx;
      this.y += dy;
    }
  }

  randomizeDirection() {
    this.angle = floor(random(0, this.directions.length));
  }

  //d is a direction {x, y}
  //isFood indicates if we're scoring for food or home
  getScoreForDirection(d, isFood) {
    //I keep meaning to sketch this out on graph paper - 
    //I'm certain I made a few logical errors in here.
    //However, I actually found this particular behavior (right or not)
    //worked pretty well, and my attempts at fixing it always made it worse!

    let range = this.simulation.vars.sight;

    let x0 = this.x + d.x * range;
    let y0 = this.y + d.y * range;
    let score = 0;
    for (var x = x0 - range / 2; x <= x0 + (range / 2); x++) {
      for (var y = y0 - (range / 2); y <= y0 + (range / 2); y++) {
        let c = this.simulation.getCell(round(x), round(y));
        var wScore = this.scoreForCell(c, isFood);

        wScore /= (dist(x0, y0, x, y) + 1); //This is the bit that's probably wrong
        score += wScore;
      }
    }

    let fwdCell = this.simulation.getCell(this.x + d.x, this.y + d.y);
    score += this.scoreForCell(fwdCell, isFood);
    return score;
  }

  scoreForCell(c, isFood) {
    if (c == null) {
      return 0;
    }
    else {
      if (isFood) {
        if (c.type == FOOD) {
          return 100;
        }
        else {
          return c.foodPheremone;
        }
      } else {
        if (c.type == HOME) {
          return 100;
        }
        else {
          //Check if cell closer to home than ant and add it to home pheromone
          const h = this.simulation.home;

          let reward = 0;
          const dc = Math.abs(c.x - h.x) + Math.abs(c.y - h.y);
          const da = Math.abs(this.x - h.x) + Math.abs(this.y - h.y);

          if (dc > da) {
            reward = -this.simulation.vars.homeRewardOffset;
          }
          else if (dc < da) {
            reward = this.simulation.vars.homeRewardOffset;
          }


          //return c.homePheremone + reward;
          return reward;
        }
      }

    }

  }

  forageForFood() {
    this.seek(true);
  }

  lookForHome() {
    this.seek(false);
  }


  seek(isFood) {
    let sensed = this.sensed();

    let fwdLeft = sensed[0];
    let fwd = sensed[1];
    let fwdRight = sensed[2];

    //let maxScore = 0;
    let bestDirection = fwd;
    let totalScore = 0;

    const scores = [];

    for (let i = 0; i < sensed.length; i++) {
      const direction = sensed[i];
      let score = Math.pow(this.getScoreForDirection(direction, isFood), this.simulation.vars.scorePower);
      scores[i] = score;
      totalScore += score;

      //Instead of max score get randomized value
      // if (score > maxScore) {
      //   maxScore = score;
      //   bestDirection = direction;
      // }
    }


    if (totalScore === 0 || (1 - this.simulation.vars.randomDirectionChance) < Math.random()) {
      this.walkRandomly();
    }
    else {
      const r = Math.floor(Math.random() * totalScore);

      let t = 0;
      for (const i in scores) {
        t += scores[i];

        if (r < t) {
          bestDirection = sensed[i];
          break;
        }
      }


      let [fwdX, fwdY] = [0, 0];


      if (bestDirection == fwdRight) {
        this.turnRight();
        // fwdX = fwdRight.x;
        // fwdY = fwdRight.y;
      } else if (bestDirection == fwdLeft) {
        this.turnLeft();
        // fwdX = fwdLeft.x;
        // fwdY = fwdLeft.y;
      } else {
        fwdX = fwd.x;
        fwdY = fwd.y;
      }

      this.move(fwdX, fwdY)
    }
  }
}