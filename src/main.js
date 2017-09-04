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
let DRAG_LEFT_START_WIDTH = 0;
let PINCH_BEGAN = null;

const touchStart = function({x, y}){
  x = (x - SCROLL.x) / ZOOM.z;
  y = (y - SCROLL.y) / ZOOM.z;

  TOUCH_BEGAN = {x, y};
  TOUCH_NODE = nodeAt(0, 0, {x, y}, TREE);

  initDrag();

  requestDraw();
};

const touchMove = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }
  x = (x - SCROLL.x) / ZOOM.z;
  y = (y - SCROLL.y) / ZOOM.z;

  doDrag({x, y});

  requestDraw();
};

const touchEnd = function({x, y}){
  if (!TOUCH_BEGAN) {
    return;
  }
  x = (x - SCROLL.x) / ZOOM.z;
  y = (y - SCROLL.y) / ZOOM.z;

  if (DRAG_MODE) {
    doDrag({x, y});
    dragDrop();
  } else {
    // just a click
    doClick(TOUCH_BEGAN);
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
  PINCH_BEGAN = { p1: {x: x1, y: y1}, p2: {x: x2, y: y2} };

  requestDraw();
};

const pinchMove = function({x: x1, y: y1}, {x: x2, y: y2}) {
  if (!PINCH_BEGAN) {
    return;
  }

  changeZoom({
    ox1: PINCH_BEGAN.p1.x, oy1: PINCH_BEGAN.p1.y,
    ox2: PINCH_BEGAN.p2.x, oy2: PINCH_BEGAN.p2.y,
    nx1: x1, ny1: y1,
    nx2: x2, ny2: y2});

  requestDraw();
};

const pinchEnd = function({x: x1, y: y1}, {x: x2, y: y2}) {
  if (!PINCH_BEGAN) {
    return;
  }

  pinchMove({x: x1, y: y1}, {x: x2, y: y2});
  finishZoom();

  PINCH_BEGAN = null;

  requestDraw();
};

//// register touch handlers
GET_TOUCHY(cnv, {
  touchStart,
  touchMove,
  touchEnd,
  touchCancel,
  pinchStart,
  pinchMove,
  pinchEnd,
});

window.addEventListener('wheel', function (e) {
  e.preventDefault();

  const cx = e.pageX;
  const cy = e.pageY;
  let delta = -e.deltaY;

  if (e.deltaMode === 0x01) {
    delta *= 20;
  }
  if (e.deltaMode === 0x02) {
    delta *= 20 * 10;
  }

  changeZoomMouse({delta, cx, cy});
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
    // starting drag
    if (TOUCH_NODE) {
      // dragging a node
      if (dx > dragDist || dx < -dragDist) {
        if (dx > dragDist) {
          console.log('drag right');
          DRAG_MODE = 'right';
        } else {
          console.log('drag left');
          DRAG_LEFT_START_WIDTH = TREE.width;
          DRAG_MODE = 'left';
        }

        const p = TOUCH_NODE.handle ? null : findParent(TOUCH_NODE, TREE);
        if (p == null) {
          // root or handle can have no siblings
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

        if (TOUCH_NODE.handle) {
          // can't delete handles
          DRAG_MODE = 'pan';
        } else if (!findParent(TOUCH_NODE, TREE)) {
          // don't want to make it easy to delete the whole tree
          DRAG_MODE = 'pan';
        } else {
          TOUCH_NODE.slidOut = 0;
          TOUCH_NODE.slideUnder = true;
        }
      } else if (dy < -dragDist) {
        console.log('drag up');
        DRAG_MODE = 'up';

        const p = TOUCH_NODE.handle ? TOUCH_NODE.p : findParent(TOUCH_NODE, TREE);
        if (p == null) {
          // new root
          NEW_NODE = {name: '', children: [TREE], slidOut: 0};
          TREE = NEW_NODE;
        } else if (TOUCH_NODE.handle) {
          NEW_NODE = {name: '', children: [], slidOut: 0};
          p.children = [NEW_NODE];
        } else {
          NEW_NODE = {name: '', children: [TOUCH_NODE], slidOut: 0};
          replaceChild(p, TOUCH_NODE, NEW_NODE);
        }
      }
    } else {
      // dragging nothing, just pan
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

    measureTree(ctx, TREE);

    if (DRAG_MODE == 'left') {
      SCROLL.tx = DRAG_LEFT_START_WIDTH - TREE.width;
    }
  } else if (DRAG_MODE == 'down') {
    const slidOut = Math.max(0, Math.min(lineHeight, lineHeight - dy));
    TOUCH_NODE.slidOut = slidOut;
    measureTree(ctx, TREE);
  } else if (DRAG_MODE == 'up') {
    const slidOut = Math.max(0, Math.min(lineHeight, -dy));
    NEW_NODE.slidOut = slidOut;
    measureTree(ctx, TREE);
  } else if (DRAG_MODE == 'pan') {
    SCROLL.tx = dx * ZOOM.z;
    SCROLL.ty = dy * ZOOM.z;
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
    } else {
      SCROLL.x += SCROLL.tx;
    }
    SCROLL.tx = 0;

    NEW_NODE.slidOver = null;
    NEW_NODE = null;
  } else if (DRAG_MODE == 'down') {
    if (TOUCH_NODE.slidOut == 0) {
      const p = findParent(TOUCH_NODE, TREE);
      let lastChild = TOUCH_NODE;

      // copy my children as siblings
      for (let i = 0; i < TOUCH_NODE.children.length; ++i) {
        addSiblingAfter(p, lastChild, TOUCH_NODE.children[i]);
        lastChild = TOUCH_NODE.children[i];
      }
      TOUCH_NODE.children = [];

      removeChild(p, TOUCH_NODE);
    }

    TOUCH_NODE.slidOut = null;
    TOUCH_NODE.slideUnder = false;
  } else if (DRAG_MODE == 'up') {
    if (NEW_NODE.slidOut < lineHeight) {
      // cancel new node
      if (NEW_NODE == TREE) {
        TREE = NEW_NODE.children[0];
      } else if (TOUCH_NODE.handle) {
        TOUCH_NODE.p.children = [];
      } else {
        const p = findParent(NEW_NODE, TREE);
        replaceChild(p, NEW_NODE, TOUCH_NODE);
      }
    }
    NEW_NODE.slidOut = null;
    NEW_NODE = null;
  } else if (DRAG_MODE == 'pan') {
    SCROLL.x += SCROLL.tx;
    SCROLL.y += SCROLL.ty;
    SCROLL.tx = 0;
    SCROLL.ty = 0;
  }

  DRAG_MODE = null;
  DRAG_FEEL_X = 0;
  DRAG_FEEL_Y = 0;
};

let CANCEL_PROMPT = null;
const PROMPT = document.getElementById('prompt');
const PROMPT_FORM = document.getElementById('prompt-form');
const PROMPT_MSG = document.getElementById('prompt-msg');
const PROMPT_INPUT = document.getElementById('prompt-input');

const promptText = function (init, msg, cb, cbc) {
  if (typeof init !== 'string') {
    init = '';
  }

  if (CANCEL_PROMPT) {
    CANCEL_PROMPT();
  }

  PROMPT_MSG.textContent = msg;
  PROMPT.style.visibility = 'visible';

  const submitHandler = function (e) {
    const value = PROMPT_INPUT.value;
    cancelPromptText(submitHandler);
    PROMPT_INPUT.blur();
    e.preventDefault();

    cb(value);
  };

  PROMPT_FORM.addEventListener('submit', submitHandler);

  PROMPT_INPUT.value = init;
  PROMPT_INPUT.focus();

  CANCEL_PROMPT = function () {
    cancelPromptText(submitHandler);
    if (!!cbc) {
      cbc();
    }
  };
};

const cancelPromptText = function (submitHandler) {
  PROMPT_INPUT.blur();
  PROMPT_INPUT.value = '';
  PROMPT.style.visibility = 'hidden'
  PROMPT_FORM.removeEventListener('submit', submitHandler);
  CANCEL_PROMPT = null;
};

const doClick = function({x, y}) {
  const node = nodeAt(0, 0, {x, y}, TREE);

  if (!node || node.handle) {
    return;
  }

  promptText(node.name, 'Enter name', function(name) {
    node.name = name;
    node.textWidth = null;
    measureTree(ctx, TREE);
    requestDraw();
  }, null);
};

//// zooming
const changeZoom = function({ox1, oy1, ox2, oy2, nx1, ny1, nx2, ny2}) {
  // "real" locations of the original zooming points
  const x1r = (ox1 - SCROLL.x) / ZOOM.z;
  const y1r = (oy1 - SCROLL.y) / ZOOM.z;
  const x2r = (ox2 - SCROLL.x) / ZOOM.z;
  const y2r = (oy2 - SCROLL.y) / ZOOM.z;
  const dxr = x1r - x2r;
  const dyr = y1r - y2r;

  // old distance
  const rd2 = dxr * dxr + dyr * dyr;
  // new distance
  const ndx = nx1 - nx2;
  const ndy = ny1 - ny2;
  const nd2 = ndx * ndx + ndy * ndy;
  // desired new zoom
  const z = Math.sqrt(nd2 / rd2);
  ZOOM.tz = z / ZOOM.z;

  // "real" location of original center
  const cxr = (x1r + x2r) / 2;
  const cyr = (y1r + y2r) / 2;
  // new center
  const ncx = (nx1 + nx2) / 2;
  const ncy = (ny1 + ny2) / 2;

  // desired new scroll
  const sx = ncx - cxr * z;
  const sy = ncy - cyr * z;
  SCROLL.tx = sx - SCROLL.x;
  SCROLL.ty = sy - SCROLL.y;
};

const changeZoomMouse = function({delta, cx, cy}) {
  // desired new zoom
  const z = ZOOM.z * Math.pow(2, delta / 100);

  // "real" location of original center
  const cxr = (cx - SCROLL.x) / ZOOM.z;
  const cyr = (cy - SCROLL.y) / ZOOM.z;

  // desired new scroll
  const sx = cx - cxr * z;
  const sy = cy - cyr * z;
  SCROLL.x = sx;
  SCROLL.y = sy;
  ZOOM.z = z;
};

const finishZoom = function() {
  SCROLL.x += SCROLL.tx;
  SCROLL.y += SCROLL.ty;
  SCROLL.tx = 0;
  SCROLL.ty = 0;
  ZOOM.z *= ZOOM.tz;
  ZOOM.tz = 1;
};

//// tree manipulation
const fontSize = 24;
const lineHeight = fontSize * 2;

/*
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
*/

let TREE = {name: '', children: []};
let SCROLL = {x: 100.5, y: 100.5, tx: 0, ty: 0};
let ZOOM = {z: 1, tz: 1};

const measureTree = function(ctx, tree) {
  const measureTextWidth = function(text) {
    ctx.font = `${fontSize}px monospace`;
    return ctx.measureText(text).width;
  };

  if (typeof tree.textWidth != 'number') {
    tree.textWidth = measureTextWidth(tree.name);
  }

  let nameWidth = Math.max(lineHeight, tree.textWidth + fontSize);
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
    let nonSlidingChildren = 0;

    tree.children.forEach(function(child) {
      if (typeof child.slidOver != 'number') {
        ++ nonSlidingChildren;
      }
    });
    const adjust = (tree.width - tree.childrenWidth) / nonSlidingChildren;

    tree.children.forEach(function(child) {
      if (typeof child.slidOver != 'number') {
        child.width += adjust;
        widenTree(child);
      }
    });
    tree.childrenWidth = adjust * nonSlidingChildren;
  }
};

const drawTree = function(
    tree, x, y, idx, depth, layers, layerSolid, layerLines) {
  if (tree == TOUCH_NODE) {
    if (tree.slideUnder) {
      layerSolid = layers.bgSolid;
      layerLines = layers.bgLines;
    } else {
      x += DRAG_FEEL_X;
      y += DRAG_FEEL_Y;
      layerSolid = layers.fgSolid;
      layerLines = layers.fgLines;
    }
  }

  let height = lineHeight;
  if (typeof tree.slidOut == 'number') {
    height = tree.slidOut;
  }

  if (tree.children) {
    let childXOffset = 0;
    tree.children.forEach(function(child, childIdx) {
      drawTree(child, x + childXOffset, y - height, childIdx, depth + 1,
               layers, layerSolid, layerLines);
      childXOffset += child.width;
    });
  }

  if (!tree.children || tree.children.length == 0) {
    // handle
    layerSolid.push(
        {op: 'strokeRect', strokeStyle: '#f0f0f0', lineWidth: 3,
         x: x + 1,
         y: y - height - lineHeight + 1,
         w: tree.width-2,
         h: lineHeight-2
        });

    // highlight handle if it is being dragged
    if (TOUCH_NODE && TOUCH_NODE.handle &&
        (TOUCH_NODE.p == tree ||
         (TOUCH_NODE.p.children && TOUCH_NODE.p.children[0] == tree))) {
      layers.fgLines.push(
        {op: 'strokeRect', strokeStyle: 'black',
         lineWidth: 3,
         x: x,
         y: y - height - lineHeight,
         w: tree.width,
         h: lineHeight
        });
    }
  }

  // main body of the node
  const boxFillStyle = depth % 2 == 0 ? '#f0f0f0' : '#e0e0e0';
  layerSolid.push(
      {op: 'fillRect', fillStyle: boxFillStyle,
       x: x,
       y: y - height,
       w: tree.width,
       h: height
      });

  // text label
  layerLines.push(
      {op: 'fillText', fillStyle: 'black',
       font: `${fontSize}px monospace`,
       textAlign: 'center',
       textBaseline: 'middle',
       msg: tree.name,
       cx: x + tree.width / 2,
       cy: y - height + lineHeight / 2
      });

  // dividing line
  layerLines.push(
      {op: 'stroke', strokeStyle: 'black',
       lineWidth: 1,
       path: [[{x: x + tree.width, y: y - height},
               {x: x + tree.width, y: y}]]
      });

  // highlight node if it is being dragged
  // or if this is a new node and it is locked in (slid completely)
  if (tree == TOUCH_NODE ||
      (tree == NEW_NODE &&
       (tree.slidOver == lineHeight || tree.slidOut == lineHeight))) {
    layers.fgLines.push(
        {op: 'strokeRect', strokeStyle: 'black',
         lineWidth: 3,
         x: x,
         y: y - height,
         w: tree.width,
         h: height
        });
  }
};

const renderLayer = function(ctx, layer) {
  const sx = SCROLL.x + SCROLL.tx;
  const sy = SCROLL.y + SCROLL.ty;
  const z = ZOOM.z * ZOOM.tz;

  layer.forEach(function(cmd) {
    switch (cmd.op) {
      case 'fillText':
        ctx.fillStyle = cmd.fillStyle;
        ctx.font = cmd.font;
        ctx.textAlign = cmd.textAlign;
        ctx.textBaseline = cmd.textBaseline;
        ctx.fillText(cmd.msg, cmd.cx * z + sx, cmd.cy * z + sy);
        break;
      case 'fillRect':
        ctx.fillStyle = cmd.fillStyle;
        ctx.fillRect(cmd.x * z + sx, cmd.y * z + sy, cmd.w * z, cmd.h * z);
        break;
      case 'strokeRect':
        ctx.strokeStyle = cmd.strokeStyle;
        ctx.lineWidth = cmd.lineWidth * z;
        ctx.strokeRect(cmd.x * z + sx, cmd.y * z + sy, cmd.w * z, cmd.h * z);
        break;
      case 'stroke':
        ctx.beginPath();
        cmd.path.forEach(function(segment) {
          ctx.moveTo(segment[0].x * z + sx, segment[0].y * z + sy);
          for (let i = 1; i < segment.length; ++i) {
            ctx.lineTo(segment[i].x * z + sx, segment[i].y * z + sy);
          }
        });
        ctx.strokeStyle = cmd.strokeStyle;
        ctx.lineWidth = cmd.lineWidth * z;
        ctx.stroke();
        break;
    }
  });
};

const drawObjects = function(ctx) {
  measureTree(ctx, TREE);

  const layers =
  {
    bgSolid: [],
    bgLines: [],
    midSolid: [],
    midLines: [],
    fgSolid: [],
    fgLines: [],
  };

  drawTree(TREE, 0, 0, 0, 0, layers, layers.midSolid, layers.midLines);

  renderLayer(ctx, layers.bgSolid);
  renderLayer(ctx, layers.bgLines);
  renderLayer(ctx, layers.midSolid);
  renderLayer(ctx, layers.midLines);
  renderLayer(ctx, layers.fgSolid);
  renderLayer(ctx, layers.fgLines);
};

const nodeAt = function(treeX, treeY, {x, y}, tree) {
  if (x >= treeX && x < treeX + tree.width &&
      y >= treeY - lineHeight && y < treeY) {
    return tree;
  }

  if (!tree.children || tree.children.length == 0) {
    // check for handle
    if (x >= treeX && x < treeX + tree.width &&
        y >= treeY - lineHeight * 2 && y < treeY - lineHeight) {
      return {handle: true, p: tree};
    }
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
