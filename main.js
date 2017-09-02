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
let TOUCH_NODE = null;
let NEW_NODE = null;
let DRAG_MODE = null;
let DRAG_FEEL_X = 0;
let DRAG_FEEL_Y = 0;

const touchStart = function({x, y}){
  TOUCH_BEGAN = {x, y};
  TOUCH_NODE = nodeAt(TREE_POS.x, TREE_POS.y, {x, y}, TREE);

  initDrag();

  requestDraw();
};

const touchMove = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }

  doDrag({x, y});

  requestDraw();
};

const touchEnd = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }

  if (DRAG_MODE) {
    doDrag({x, y});
    dragDrop();
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

  if (DRAG_MODE) {
    dragDrop()
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

////

const initDrag = function() {
  DRAG_MODE = null;
  DRAG_FEEL_X = 0;
  DRAG_FEEL_Y = 0;
};

const doDrag = function({x, y}) {
  const dx = x - TOUCH_BEGAN.x;
  const dy = y - TOUCH_BEGAN.y;
  DRAG_FEEL_X = dx;
  DRAG_FEEL_Y = dy;
  if (!DRAG_MODE) {
    if (TOUCH_NODE) {
      if (dx > dragDist || dx < -dragDist) {
        if (dx > dragDist) {
          console.log('drag right');
          DRAG_MODE = 'right';
        } else {
          console.log('drag left');
          DRAG_MODE = 'left';
        }

        const p = findParent(TOUCH_NODE, TREE);
        if (p == null) {
          // root can have no siblings
          DRAG_MODE = 'pan';
        } else {
          NEW_NODE = {name: '', children: [], slidOver: 0};
          if (dx > dragDist) {
            addSiblingBefore(p, TOUCH_NODE, NEW_NODE);
          } else {
            addSiblingAfter(p, TOUCH_NODE, NEW_NODE);
          }
        }
      } else if (dy > dragDist) {
        console.log('drag down');
        DRAG_MODE = 'down';

        if (!findParent(TOUCH_NODE, TREE)) {
          // don't want to make it easy to delete the whole tree
          DRAG_MODE = 'pan';
        } else {
          TOUCH_NODE.slidOut = 0;
          TOUCH_NODE.slideUnder = true;
        }
      } else if (dy < -dragDist) {
        console.log('drag up');
        DRAG_MODE = 'up';

        const p = findParent(TOUCH_NODE, TREE);
        if (p == null) {
          // new root
          NEW_NODE = {name: '', children: [TREE], slidOut: 0};
          TREE = NEW_NODE;
        } else {
          NEW_NODE = {name: '', children: [TOUCH_NODE], slidOut: 0};
          replaceChild(p, TOUCH_NODE, NEW_NODE);
        }
      }
    } else {
      DRAG_MODE = 'pan';
    }
  }

  if (DRAG_MODE) {
    DRAG_FEEL_X = 0;
    DRAG_FEEL_Y = 0;
  }
  
  if (DRAG_MODE == 'left' || DRAG_MODE == 'right') {
    const slidOver =
      Math.max(0, Math.min(lineHeight, DRAG_MODE == 'right' ? dx : -dx));
    NEW_NODE.slidOver = slidOver;

    if (DRAG_MODE == 'left') {
      TREE_POS.xOff = -slidOver;
    }

    measureTree(ctx, TREE);
  } else if (DRAG_MODE == 'down') {
    const slidOut = Math.max(0, Math.min(lineHeight, lineHeight - dy));
    TOUCH_NODE.slidOut = slidOut;
    measureTree(ctx, TREE);
  } else if (DRAG_MODE == 'up') {
    const slidOut = Math.max(0, Math.min(lineHeight, -dy));
    NEW_NODE.slidOut = slidOut;
    measureTree(ctx, TREE);
  }
};

const dragDrop = function() {
  if (!DRAG_MODE) {
    return;
  }

  if (DRAG_MODE == 'left' || DRAG_MODE == 'right') {
    if (NEW_NODE.slidOver < lineHeight) {
      const p = findParent(NEW_NODE, TREE);
      removeChild(p, NEW_NODE);
    }

    TREE_POS.x += TREE_POS.xOff;
    TREE_POS.xOff = 0;

    NEW_NODE.slidOver = null;
    NEW_NODE = null;
  } else if (DRAG_MODE == 'down') {
    if (TOUCH_NODE.slidOut == 0) {
      const p = findParent(TOUCH_NODE, TREE);
      removeChild(p, TOUCH_NODE);
    }

    TOUCH_NODE.slidOut = null;
    TOUCH_NODE.slideUnder = false;
  } else if (DRAG_MODE == 'up') {
    if (NEW_NODE.slidOut < lineHeight) {
      // cancel new node
      if (NEW_NODE == TREE) {
        TREE = NEW_NODE.children[0];
      } else {
        const p = findParent(NEW_NODE, TREE);
        replaceChild(p, NEW_NODE, TOUCH_NODE);
      }
    }
    NEW_NODE.slidOut = null;
    NEW_NODE = null;
  }

  DRAG_MODE = null;
  DRAG_FEEL_X = 0;
  DRAG_FEEL_Y = 0;
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

const defunFib = 
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

let TREE = defunFib;
let TREE_POS = {x: 100.5, y: 200.5, xOff: 0};

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
      //widenTree(tree);
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
    if (tree.slideUnder) {
      if (drawBot) {
        drawBot = false;
      } else {
        return;
      }
    } else if (drawTop) {
      x += DRAG_FEEL_X;
      y += DRAG_FEEL_Y;
      drawTop = false;
    } else {
      return;
    }
  }


  let height = lineHeight;
  if (typeof tree.slidOut == 'number') {
    height = tree.slidOut;
  }

  if (tree.children) {
    let childXOffset = 0;
    tree.children.forEach(function(child, childIdx) {
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
  ctx.fillRect(x, y - height, tree.width, height);

  ctx.fillStyle = 'black'
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tree.name, x + tree.width / 2, y - height + lineHeight / 2);

  // dividing line
  ctx.beginPath();
  ctx.moveTo(x + tree.width, y - height);
  ctx.lineTo(x + tree.width, y - height + lineHeight);
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (tree == TOUCH_NODE ||
      (tree == NEW_NODE &&
       (tree.slidOver == lineHeight || tree.slidOut == lineHeight))) {
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y - height, tree.width, height);
  }
};

const drawObjects = function(ctx) {
  measureTree(ctx, TREE);
  drawTree(ctx, TREE, TREE_POS.x + TREE_POS.xOff, TREE_POS.y, 0, 0, true, false);
  drawTree(ctx, TREE, TREE_POS.x + TREE_POS.xOff, TREE_POS.y, 0, 0, false, false);
  drawTree(ctx, TREE, TREE_POS.x + TREE_POS.xOff, TREE_POS.y, 0, 0, false, true);
};

const nodeAt = function(treeX, treeY, {x, y}, tree) {
  if (x >= treeX && x < treeX + tree.width &&
      y >= treeY - lineHeight && y < treeY) {
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

const removeChild = function(parentNode, node) {
  if (!parentNode.children) {
    return;
  }

  for (let i = 0; i < parentNode.children.length; ++i) {
    const child = parentNode.children[i];

    if (child == node) {
      parentNode.children.splice(i, 1);
      return;
    }
  }
};

const addSiblingBefore = function(parentNode, node, newNode) {
  if (!parentNode.children) {
    return;
  }

  for (let i = 0; i < parentNode.children.length; ++i) {
    const child = parentNode.children[i];
    if (child == node) {
      parentNode.children.splice(i, 0, newNode);
      return;
    }
  }
};

const addSiblingAfter = function(parentNode, node, newNode) {
  if (!parentNode.children) {
    return;
  }

  for (let i = 0; i < parentNode.children.length; ++i) {
    const child = parentNode.children[i];
    if (child == node) {
      parentNode.children.splice(i + 1, 0, newNode);
      return;
    }
  }
};

//// kick off first draw
resize();
})();
