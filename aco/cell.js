class Cell {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.type = EMPTY;
      this.foodPheremone = 0;
      this.homePheremone = 0;
    }
  }