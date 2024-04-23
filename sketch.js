
/// <reference path="./p5.js" />
/// <reference path="./aco/simulation.js" />



function setup() {
  createCanvas(pixelWidth * sizeMultiplier, pixelHeight * sizeMultiplier);
  pg = createGraphics(pixelWidth, pixelHeight);
  pg.frameRate(30);

  sim = new Simulation(pg);
}

function draw() {
  sim.run();
  sim.draw();
}

function mouseClicked() {
  sim.addFood(round(mouseX / sizeMultiplier), round(mouseY / sizeMultiplier));
}

function touchEnded() {
  sim.addFood(round(mouseX / sizeMultiplier), round(mouseY / sizeMultiplier));
}