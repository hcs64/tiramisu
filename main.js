(function(){
'use strict';

//// graphics setup

const dpr = window.devicePixelRatio ? window.devicePixelRatio : 1;
const cnv = document.getElementById('cnv');
const ctx = cnv.getContext('2d');

let WIDE = window.innerWidth;
let HIGH = window.innerHeight;

let drawRequested = false;
const draw = function(t) {
  drawRequested = false;

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, WIDE, HIGH);

  drawObjects(ctx);
};
const requestDraw = function() {
  if (!drawRequested) {
    drawRequested = true;

    window.requestAnimationFrame(draw);
  }
};

const resize = function() {
  WIDE = window.innerWidth;
  HIGH = window.innerHeight;

  cnv.width = WIDE * dpr;
  cnv.height = HIGH * dpr;

  cnv.style.width = `${WIDE}px`;
  cnv.style.height = `${HIGH}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  requestDraw();
};

window.addEventListener('resize', resize);
window.addEventListener('focus',  requestDraw);

//// mid-level touch handlers

const dragDist = 10;
let TOUCH_BEGAN = null;
let DRAGGING = false;

const touchStart = function({x, y}){
  TOUCH_BEGAN = {x, y};
  DRAGGING = false;
};

const touchMove = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }

  const dx = x - TOUCH_BEGAN.x;
  const dy = y - TOUCH_BEGAN.y;
  if (!DRAGGING && dx * dx + dy * dy > dragDist * dragDist) {
    DRAGGING = true;
    dragStart(x, y);
  }
  
  if (DRAGGING) {
    drag(x, y);
  }
};

const touchEnd = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }

  touchMove({x, y});

  if (DRAGGING) {
    drop();
    DRAGGING = false;
  } else {
    click();
  }

  TOUCH_BEGAN = null;
};

const touchCancel = function() {
  if (!TOUCH_BEGAN) {
    return;
  }

  if (DRAGGING) {
    drop();
    DRAGGING = false;
  }

  TOUCH_BEGAN = null;
};

const pinchStart = function({x: x1, y: y1}, {x: x2, y: y2}) {
};

const pinchMove = function({x: x1, y: y1}, {x: x2, y: y2}) {
};

const pinchEnd = function({x: x1, y: y1}, {x: x2, y: y2}) {
};

//// register touch handlers
GET_TOUCHY(window, {
  touchStart,
  touchMove,
  touchEnd,
  touchCancel,
  pinchStart,
  pinchMove,
  pinchEnd,
});

window.addEventListener('wheel', function (e) {
}, {passive: false});

//// high level touch handlers
let DRAGGED = null
const click = function() {
  const o = objectAt(TOUCH_BEGAN);

  if (o) {
    removeObject(o);
  } else {
    createObjectAt(TOUCH_BEGAN);
  }

  requestDraw();
};

const dragStart = function(x, y) {
  if (!DRAGGED) {
    DRAGGED = objectAt(TOUCH_BEGAN);
  }

  requestDraw();
};

const drag = function(x, y) {
  if (!DRAGGED) {
    SCROLL.tx = x - TOUCH_BEGAN.x;
    SCROLL.ty = y - TOUCH_BEGAN.y;
    requestDraw();
    return;
  }

  moveObjectTo(DRAGGED, x, y);

  requestDraw();
};

const drop = function() {
  if (!DRAGGED) {
    SCROLL.x += SCROLL.tx;
    SCROLL.y += SCROLL.ty;
    SCROLL.tx = 0;
    SCROLL.ty = 0;
    return;
  }

  DRAGGED = null;

  requestDraw();
};

//// tree manipulation
const fontSize = 20;
const lineHeight = fontSize * 1.5;

const recursiveCall =
{name: '+',
 children: [
   {name: 'fib is the name of this thing',
    children: [
      {name: '-',
       children: [
         {name: 'n'},
         {name: '1'},
       ]},
      {name: '-',
       children: [
        {name: 'n'},
        {name: '2'},
      ]},
    ]},
 ]
};

const TREE = 
{name: 'defun',
 children: [
   {name: 'fib'},
   {name: '()',
    children: [
      {name: 'x'},
    ]},
   {name: 'if',
    children: [
      {name: '<',
       children: [
         {name: 'n'},
         {name: '2'},
       ]},
       {name: '1'},
       recursiveCall,
    ]},
 ]
};

const measureTree = function(ctx, tree) {
  const measureTextWidth = function(text) {
    ctx.font = `${fontSize}px monospace`;
    return ctx.measureText(text).width;
  };

  if (typeof tree.textWidth != 'number') {
    tree.textWidth = measureTextWidth(tree.name);
  }

  let nameWidth = tree.textWidth + fontSize;
  if (typeof tree.slidOver == 'number') {
    nameWidth = Math.abs(tree.slidOver);
  }
  tree.childrenWidth = 0;
  if (tree.children) {
    tree.children.forEach(function(child) {
      measureTree(ctx, child);
      tree.childrenWidth += child.width;
    });
  }

  if (nameWidth <= tree.childrenWidth) {
    tree.width = tree.childrenWidth;
  } else {
    tree.width = nameWidth;

    if (tree.children) {
      widenTree(tree);
    }
  }
};

const widenTree = function(tree) {
  if (tree.childrenWidth < tree.width && tree.children) {
    const adjust = tree.width - tree.childrenWidth;
    tree.childrenWidth = tree.width;

    tree.children.forEach(function(child) {
      child.width += adjust / tree.children.length;
      widenTree(child);
    });
  }
};

const drawTree = function(ctx, tree, x, y, idx, depth) {

  if (tree.children) {
    let childXOffset = 0;
    tree.children.forEach(function(child, childIdx) {
      const height = typeof child.slidOut == 'number' ? child.slidOut : lineHeight;
      drawTree(ctx, child, x + childXOffset, y - height, childIdx, depth + 1);
      childXOffset += child.width;
    });
  }

  if (depth % 2 == 0) {
    ctx.fillStyle = '#f0f0f0';
  } else {
    ctx.fillStyle = '#e0e0e0';
  }
  ctx.fillRect(x, y, tree.width, lineHeight);

  ctx.fillStyle = 'black'
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tree.name, x + tree.width / 2, y + lineHeight / 2);

  // dividing line
  ctx.beginPath();
  ctx.moveTo(x + tree.width, y);
  ctx.lineTo(x + tree.width, y + lineHeight);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.stroke();
};
    
const drawObjects = function(ctx) {
  measureTree(ctx, TREE);
  drawTree(ctx, TREE, 200.5, 200.5, 0, 0);
};

//// kick off first draw
resize();
})();
