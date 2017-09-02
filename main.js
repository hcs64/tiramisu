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

const dragDist = 20;
let TOUCH_BEGAN = null;
let TOUCH_NODE = null;
let NEW_NODE = null;
let DRAGGING = false;
let DRAG_MODE = null;

const touchStart = function({x, y}){
  TOUCH_BEGAN = {x, y};
  TOUCH_NODE = nodeAt(100.5, 200.5, {x, y}, TREE);
  DRAGGING = false;

  requestDraw();
};

const touchMove = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }

  const dx = x - TOUCH_BEGAN.x;
  const dy = y - TOUCH_BEGAN.y;
  if (!DRAGGING) {
    if (TOUCH_NODE) {
      if (dx > dragDist) {
        console.log('drag right');
        DRAGGING = true;
      } else if (dx < -dragDist) {
        console.log('drag left');
        DRAGGING = true;
      } else if (dy > dragDist) {
        console.log('drag down');
        DRAGGING = true;
      } else if (dy < -dragDist) {
        console.log('drag up');
        const p = findParent(TOUCH_NODE, TREE);
        if (p == null) {
        } else {
          NEW_NODE = {name: '', children: [TOUCH_NODE], slidOut: 0};
          replaceChild(p, TOUCH_NODE, NEW_NODE);
        }
        DRAG_MODE = 'up';
        DRAGGING = true;
      }
    }
  }
  
  if (DRAGGING) {
    if (DRAG_MODE == 'up') {
      const slidOut = Math.max(0, Math.min(lineHeight, -dy));
      NEW_NODE.slidOut = slidOut;
      measureTree(ctx, TREE);
    }
  }

  requestDraw();
};

const touchEnd = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }

  if (DRAGGING) {
    // TODO drop
    DRAGGING = false;
  } else {
    // just a click
  }

  TOUCH_BEGAN = null;
  TOUCH_NODE = null;

  requestDraw();
};

const touchCancel = function() {
  if (!TOUCH_BEGAN) {
    return;
  }

  if (DRAGGING) {
    // TODO drop
    DRAGGING = false;
  }

  TOUCH_BEGAN = null;
  TOUCH_NODE = null;

  requestDraw();
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

const drawTree = function(ctx, tree, x, y, idx, depth, drawBot, drawTop) {
  if (tree == TOUCH_NODE) {
    if (drawTop) {
      x += 8;
      y += 8;
      drawTop = false;
    } else {
      drawTop = true;
    }
  }

  if (tree.children) {
    let childXOffset = 0;
    tree.children.forEach(function(child, childIdx) {
      const height = typeof child.slidOut == 'number' ?
                     child.slidOut : lineHeight;
      drawTree(ctx, child, x + childXOffset, y - height, childIdx, depth + 1,
               drawBot, drawTop);
      childXOffset += child.width;
    });
  }

  if (drawBot || drawTop) {
    return;
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
  drawTree(ctx, TREE, 100.5, 200.5, 0, 0, true, false);
  drawTree(ctx, TREE, 100.5, 200.5, 0, 0, false, false);
  drawTree(ctx, TREE, 100.5, 200.5, 0, 0, false, true);
};

const nodeAt = function(treeX, treeY, {x, y}, tree) {
  if (x >= treeX && x < treeX + tree.width &&
      y >= treeY && y < treeY + lineHeight) {
    return tree;
  }

  if (!tree.children) {
    return null;
  }

  let childXOffset = 0;
  for (let i = 0; i < tree.children.length; ++i) {
    const child = tree.children[i];
    const result = nodeAt(treeX + childXOffset, treeY - lineHeight, {x, y}, child);
    if (result) {
      return result;
    }
    childXOffset += child.width;
  }

  return null;
};

const findParent = function(searchNode, tree) {
  if (!tree.children) {
    return null;
  }
  for (let i = 0; i < tree.children.length; ++i) {
    const child = tree.children[i];
    if (child == searchNode) {
      return tree;
    }
    const result = findParent(searchNode, child);
    if (result) {
      return result;
    }
  }
  return null;
};

const replaceChild = function(parentNode, oldNode, newNode) {
  if (!parentNode.children) {
    return;
  }

  for (let i = 0; i < parentNode.children.length; ++i) {
    const child = parentNode.children[i];

    if (child == oldNode) {
      parentNode.children[i] = newNode;
      return;
    }
  }
};

//// kick off first draw
resize();
})();
