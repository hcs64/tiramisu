/* exported GET_TOUCHY */

const GET_TOUCHY = function (elem, cb){
'use strict';

let curTouches = [];
let primaryIdx = -1;
let pinchIdx1 = -1;
let pinchIdx2 = -1;

const startTouch = function (x, y, id, mouse) {
    const obj = { x, y };
    if (mouse) {
      obj.mouse = true;
    } else {
      obj.touch = id;
    }

    curTouches.push(obj);
    if (primaryIdx !== -1) {
      cb.touchCancel();
    }

    if (curTouches.length === 2 && (pinchIdx1 === -1 && pinchIdx2 === -1)) {
      pinchIdx1 = 0;
      pinchIdx2 = 1;
      primaryIdx = -1;
      cb.pinchStart(curTouches[pinchIdx1], curTouches[pinchIdx2]);
    } else {
      primaryIdx = curTouches.length - 1;
      cb.touchStart(obj);
    }
}
 
const updateTouch = function (idx, x, y) {
  const obj = curTouches[idx];
  obj.x = x;
  obj.y = y;
  
  if (idx === primaryIdx) {
    cb.touchMove(obj);
  }
};

const finishUpdateTouch = function () {
  if (curTouches.length === 2 && pinchIdx1 !== -1 && pinchIdx2 !== -1) {
    cb.pinchMove(curTouches[pinchIdx1], curTouches[pinchIdx2]);
  }
};

const endTouch = function (idx, x, y, cancelled = false) {
  if (idx === primaryIdx) {
    if (cancelled) {
      cb.touchCancel();
    } else {
      cb.touchEnd({x,y});
    }
    primaryIdx = -1;
  } else if (primaryIdx !== -1 && primaryIdx > idx) {
    primaryIdx -= 1;
  }

  // slight inaccuracy here as the other pinch point may not have had a chance
  // to update yet this event
  if (idx === pinchIdx1) {
    if (pinchIdx2 !== -1) {
      cb.pinchEnd(curTouches[pinchIdx1], curTouches[pinchIdx2]);
    }
    pinchIdx1 = -1;
  } else if (pinchIdx1 !== -1 && pinchIdx1 > idx) {
    pinchIdx1 -= 1;
  }

  if (idx === pinchIdx2) {
    if (pinchIdx1 !== -1) {
      cb.pinchEnd(curTouches[pinchIdx1], curTouches[pinchIdx2]);
    }
    pinchIdx2 = -1;
  } else if (pinchIdx2 !== -1 && pinchIdx2 > idx) {
    pinchIdx2 -= 1;
  }
 
  curTouches.splice(idx, 1);
}

const touchIdx = function (id) {
  for (let i = 0; i < curTouches.length; i ++) {
    if (curTouches[i].touch === id) {
      return i;
    }
  }

  return -1;
};

const mouseIdx = function () {
  for (let i = 0; i < curTouches.length; i ++) {
    if (curTouches[i].mouse) {
      return i;
    }
  }

  return -1;
};

let sawPointerEvent = false;

const handleTouchStart = function (e) {
  e.preventDefault();
  e.stopPropagation();

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    startTouch(t.pageX, t.pageY, t.identifier);
  }
};

const handlePointerDown = function (e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.preventManipulation) {
    e.preventManipulation();
  }

  if (!sawPointerEvent) {
    sawPointerEvent = true;
    curTouches.splice(0, curTouches.length);
    elem.removeEventListener('touchstart', handleTouchStart, {passive: false});
    elem.removeEventListener('touchmove', handleTouchMove, {passive: false});
    elem.removeEventListener('touchend', handleTouchEnd, {passive: false});
    elem.removeEventListener('touchcancel', handleTouchCancel, {passive: false});
  }

  startTouch(e.pageX, e.pageY, e.pointerId);
};

const handleMouseDown = function (e) {
  if (e.button !== 0) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  startTouch(e.pageX, e.pageY, null, true);
};

const handleTouchMove = function (e) {
  e.preventDefault();
  e.stopPropagation();

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const idx = touchIdx(t.identifier);
    if (idx === -1) {
      continue;
    }

    updateTouch(idx, t.pageX, t.pageY);
  }

  finishUpdateTouch();
};

const handlePointerMove = function (e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.preventManipulation) {
    e.preventManipulation();
  }

  const idx = touchIdx(e.pointerId);
  if (idx !== -1) {
    updateTouch(idx, e.pageX, e.pageY);
  }

  finishUpdateTouch();
};

const handleMouseMove = function (e) {
  const idx = mouseIdx();

  if (idx === -1) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  updateTouch(idx, e.pageX, e.pageY);
};

const handleTouchEnd = function (e) {
  e.preventDefault();
  e.stopPropagation();

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const idx = touchIdx(t.identifier);
    if (idx === -1) {
      continue;
    }

    endTouch(idx, t.pageX, t.pageY);
  }
};

const handlePointerUp = function (e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.preventManipulation) {
    e.preventManipulation();
  }

  const idx = touchIdx(e.pointerId);
  if (idx !== -1) {
    endTouch(idx, e.pageX, e.pageY);
  }
};

const handleMouseUp = function (e) {
  if (e.button !== 0) {
    return;
  }

  const idx = mouseIdx();

  if (idx === -1) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  endTouch(idx, e.pageX, e.pageY);
};

const handleTouchCancel = function (e) {
  const touches = e.changedTouches;

  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const idx = touchIdx(t.identifier);
    if (idx === -1) {
      continue;
    }

    endTouch(idx, t.pageX, t.pageY, true);
  }
};

const handlePointerOut = function (e) {
  const idx = touchIdx(e.pointerId);

  if (idx !== -1) {
    endTouch(idx, e.pageX, e.pageY, true);
  }
};

const handleMouseLeave = function (e) {
  const idx = mouseIdx();

  if (idx === -1) {
    return;
  }

  e.stopPropagation();

  endTouch(idx, e.pageX, e.pageY, true);
};

elem.addEventListener('touchstart', handleTouchStart, {passive: false});
elem.addEventListener('touchmove', handleTouchMove, {passive: false});
elem.addEventListener('touchend', handleTouchEnd, {passive: false});
elem.addEventListener('touchcancel', handleTouchCancel, {passive: false});

elem.addEventListener('pointerdown', handlePointerDown, {passive: false});
elem.addEventListener('pointermove', handlePointerMove, {passive: false});
elem.addEventListener('pointerup', handlePointerUp, {passive: false});
elem.addEventListener('pointerout', handlePointerOut, {passive: false});
  
elem.addEventListener('mousedown', handleMouseDown, {passive: false});
elem.addEventListener('mousemove', handleMouseMove, {passive: false});
elem.addEventListener('mouseup', handleMouseUp, {passive: false});
elem.addEventListener('mouseleave', handleMouseLeave, {passive: false});

return curTouches;

};
