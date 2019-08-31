'use strict';

function h (type, config) {
  let props = config || {};
  let key = props.key || null;
  let children = [];

  for (let i = 2; i < arguments.length; i++) {
    let vnode = arguments[i];
    if (vnode === null || vnode === true || vnode === false) ; else if (vnode.pop || typeof vnode === 'object') {
      children.push(vnode);
    } else if (typeof vnode === 'function') {
      children = vnode;
    } else {
      children.push({ type: 'text', props: { nodeValue: vnode } });
    }
  }
  props.children = children;

  return { type, props, key }
}

const arrayfy = arr => (!arr ? [] : Array.isArray(arr) ? arr : [arr]);

const isSame = (a, b) => a.type === b.type;

const isNew = (o, n) => k =>
  k !== 'children' && k !== 'key' && o[k] !== n[k];

function hashfy (arr) {
  let out = {};
  let i = 0;
  let j = 0;
  const newKids = arrayfy(arr);
  newKids.forEach(item => {
    if (item.pop) {
      item.forEach(item => {
        let key = ((item || {}).props || {}).key;
        key
          ? (out['.' + i + '.' + key] = item)
          : (out['.' + i + '.' + j] = item) && j++;
      });
      i++;
    } else {
(out['.' + i] = item) && i++;
    }
  });
  return out
}

function merge (a, b) {
  let out = {};
  for (const i in a) out[i] = a[i];
  for (const i in b) out[i] = b[i];
  return out
}
const defer = requestAnimationFrame || setTimeout;

const isFn = fn => typeof fn === 'function';

function updateProperty (dom, name, value, newValue) {
  if (name === 'style') {
    for (key in newValue) {
      let style = !newValue || !newValue[key] ? '' : newValue[key];
      dom[name][key] = style;
    }
  } else if (name[0] === 'o' && name[1] === 'n') {
    name = name.slice(2).toLowerCase();
    if (value) {
      dom.removeEventListener(name, value);
    }
    dom.addEventListener(name, newValue);
  } else {
    dom.setAttribute(name, newValue);
  }
}

function updateElement (dom, props, newProps) {
  Object.keys(newProps)
    .filter(isNew(props, newProps))
    .forEach(key => {
      if (key === 'value' || key === 'nodeValue') {
        dom[key] = newProps[key];
      } else {
        updateProperty(dom, key, props[key], newProps[key]);
      }
    });
}

function createElement (fiber) {
  const dom =
    fiber.type === 'text'
      ? document.createTextNode('')
      : document.createElement(fiber.type);
  updateElement(dom, [], fiber.props);
  return dom
}

let cursor = 0;

function update (key, reducer, value) {
  const current = this ? this : getWIP();
  value = reducer ? reducer(current.state[key], value) : value;
  current.state[key] = value;
  scheduleWork(current);
}
function resetCursor () {
  cursor = 0;
}
function useState (initState) {
  return useReducer(null, initState)
}
function useReducer (reducer, initState) {
  let current = getWIP();
  if (!current) return [initState, setter]
  let key = '$' + cursor;
  let setter = update.bind(current, key, reducer);
  cursor++;
  let state = current.state || {};
  if (key in state) {
    return [state[key], setter]
  } else {
    current.state[key] = initState;
    return [initState, setter]
  }
}

function useEffect (cb, inputs) {
  let current = getWIP();
  if (!current) return
  let key = '$' + cursor;
  cursor++;
  current.effect = current.effect || {};
  current.effect[key] = useCallback(cb, inputs);
}

function useCallback (cb, inputs) {
  return useMemo(() => cb, inputs)
}

function useMemo (cb, inputs) {
  let current = getWIP();
  if (current) {
    let hasChaged = inputs
      ? (current.oldInputs || []).some((v, i) => inputs[i] !== v)
      : true;
    if (inputs && !inputs.length && !current.isMounted) {
      hasChaged = true;
      current.isMounted = true;
    }
    current.oldInputs = inputs;

    if (hasChaged) return cb()
  }
}

function createContext (init = {}) {
  let context = init;
  let set = {};
  const update = context => {
    for (let key in set) set[key](context);
  };
  const subscribe = (fn, name) => {
    if (name in set) return
    set[name] = fn;
  };

  return { context, update, subscribe, set }
}

function useContext (ctx) {
  const [context, setContext] = useState(ctx.context);
  const name = getWIP().type.name;
  ctx.subscribe(setContext, name);
  return [context, ctx.update]
}

const options = {};
const FPS = 1000 / 60;
const [HOST, HOOK, ROOT, PLACE, UPDATE, DELETE] = [0, 1, 2, 3, 4, 5];

let updateQueue = [];
let nextWork = null;
let pendingCommit = null;
let currentFiber = null;
let once = true;

function render (vnode, el) {
  let rootFiber = {
    tag: ROOT,
    base: el,
    props: { children: vnode }
  };
  scheduleWork(rootFiber);
}

function scheduleWork (fiber) {
  updateQueue.push(fiber);
  if (!nextWork) {
    nextWork = updateQueue.shift();
    defer(workLoop);
  }
}

function workLoop (startTime = 0) {
  if (startTime && performance.now() - startTime > FPS) {
    defer(workLoop);
  } else {
    const nextTime = performance.now();
    nextWork = performWork(nextWork);
    if (nextWork) {
      workLoop(nextTime);
    } else {
      options.commitWork
        ? options.commitWork(pendingCommit)
        : commitWork(pendingCommit);
    }
  }
}

function performWork (WIP) {
  WIP.tag == HOOK ? updateHOOK(WIP) : updateHost(WIP);
  if (WIP.child) return WIP.child
  while (WIP) {
    completeWork(WIP);
    if (WIP.sibling) return WIP.sibling
    WIP = WIP.parent;
  }
}

function updateHost (WIP) {
  if (!options.end && !WIP.base) {
    WIP.base = createElement(WIP);
  }

  let parent = WIP.parent || {};
  WIP.insertPoint = parent.oldPoint;
  parent.oldPoint = WIP;
  const children = WIP.props.children;
  reconcileChildren(WIP, children);
}

function updateHOOK (WIP) {
  WIP.props = WIP.props || {};
  WIP.state = WIP.state || {};
  currentFiber = WIP;
  resetCursor();
  const children = WIP.type(WIP.props);
  reconcileChildren(WIP, children);
  currentFiber.patches = WIP.patches;
}
function fiberize (children, WIP) {
  return (WIP.children = hashfy(children, WIP.children))
}

function reconcileChildren (WIP, children) {
  const oldFibers = WIP.children;
  const newFibers = fiberize(children, WIP);
  let reused = {};

  for (let k in oldFibers) {
    let newFiber = newFibers[k];
    let oldFiber = oldFibers[k];

    if (newFiber && isSame(newFiber, oldFiber)) {
      reused[k] = oldFiber;
    } else {
      oldFiber.patchTag = DELETE;
      WIP.patches.push(oldFiber);
    }
  }

  let prevFiber = null;
  let alternate = null;

  for (let k in newFibers) {
    let newFiber = newFibers[k];
    let oldFiber = reused[k];

    if (oldFiber) {
      alternate = createFiber(oldFiber, {
        patchTag: UPDATE
      });
      if (!options.end) newFiber.patchTag = UPDATE;
      newFiber = merge(alternate, newFiber);
      newFiber.alternate = alternate;
      if (oldFiber.key) {
        newFiber.patchTag = PLACE;
      }
    } else {
      newFiber = createFiber(newFiber, {
        patchTag: PLACE
      });
    }

    newFibers[k] = newFiber;
    newFiber.parent = WIP;

    if (prevFiber) {
      prevFiber.sibling = newFiber;
    } else {
      WIP.child = newFiber;
      newFiber.oldPoint = null;
    }
    prevFiber = newFiber;
  }
  if (prevFiber) prevFiber.sibling = null;
}

function createFiber (vnode, data) {
  data.tag = isFn(vnode.type) ? HOOK : HOST;
  vnode.props = vnode.props;
  return merge(vnode, data)
}

function completeWork (fiber) {
  if (!options.end && fiber.parent) {
    fiber.parent.patches = (fiber.parent.patches || []).concat(
      fiber.patches || [],
      fiber.patchTag ? [fiber] : []
    );
  } else {
    pendingCommit = fiber;
  }
}

function commitWork (WIP) {
  WIP.patches.forEach(p => {
    commit(p);
    const e = p.effect;
    if (p.effect) {
      for (const k in e) e[k]();
    }
  });
  once = false;
  nextWork = null;
  pendingCommit = null;
}
function commit (fiber) {
  let p = fiber.parent;
  while (p.tag == HOOK) p = p.parent;
  const parent = p.base;
  let dom = fiber.base || fiber.child.base;
  p.patches = fiber.patches = [];
  if (fiber.parent.tag == ROOT) return

  switch (fiber.patchTag) {
    case UPDATE:
      updateElement(dom, fiber.alternate.props, fiber.props);
      break
    case DELETE:
      parent.removeChild(dom);
      break
    default:
      const insertPoint = fiber.insertPoint;
      let point = insertPoint ? insertPoint.base : null;
      let after = point ? point.nextSibling : parent.firstChild;
      if (after == dom) return
      if (after === null && dom === parent.lastChild) return
      if (once) after = null;
      parent.insertBefore(dom, after);
      break
  }
}

function getWIP () {
  return currentFiber || null
}

exports.createContext = createContext;
exports.createElement = h;
exports.h = h;
exports.options = options;
exports.render = render;
exports.scheduleWork = scheduleWork;
exports.useCallback = useCallback;
exports.useContext = useContext;
exports.useEffect = useEffect;
exports.useMemo = useMemo;
exports.useReducer = useReducer;
exports.useState = useState;
//# sourceMappingURL=fre.js.map
