/**
TODO
  change classes.get to take first param array, second param bool / whether to output with . or not
  don't ever emprty slideshow el?

Script: Slideshow.js
  Slideshow - A javascript class for Mootools to stream and animate the presentation of images on your website.

License:
  MIT-style license.

Copyright:
  Copyright (c) 2008 [Aeron Glemann](http://www.electricprism.com/aeron/).

Dependencies:
  Mootools 1.2 Core: Fx.Morph, Fx.Tween, Selectors, Element.Dimensions.
  Mootools 1.2 More: Assets.
*/

Slideshow = new Class({
  Implements: [Chain, Events, Options],
  
  options: {/*
    onComplete: $empty,
    onEnd: $empty,
    onStart: $empty,*/
    accesskeys: {'first': {'key': 'shift left', 'label': 'Shift + Leftwards Arrow'}, 'prev': {'key': 'left', 'label': 'Leftwards Arrow'}, 'pause': {'key': 'p', 'label': 'P'}, 'next': {'key': 'right', 'label': 'Rightwards Arrow'}, 'last': {'key': 'shift right', 'label': 'Shift + Rightwards Arrow'}},
    captions: false,
    center: true,
    classes: [],
    controller: false,
    delay: 2000,
    duration: 750,
    fast: false,
    height: false,
    href: '',
    hu: '',
    linked: false,
    loader: false,
    loop: true,
    match: /\?slide=(\d+)$/,
    overlap: true,
    paused: false,
    preload: false,
    random: false,
    replace: [/(\.[^\.]+)$/, 't$1'],
    resize: 'width',
    slide: 0,
    thumbnails: false,
    titles: true,
    transition: function(p){return -(Math.cos(Math.PI * p) - 1) / 2;},
    width: false
  },
  
  /**
  Constructor: initialize
    Creates an instance of the Slideshow class.
  
  Arguments:
    element - (element) The wrapper element.
    data - (array or object) The images and optional thumbnails, captions and links for the show.
    options - (object) The options below.
  
  Syntax:
    var myShow = new Slideshow(element, data, options);
  */

  initialize: function(el, data, options){  
    this.setOptions(options);
    this.slideshow = document.id(el);
    if (!this.slideshow)
      return;
    this.slideshow.store('html', this.slideshow.get('html'));
    this.uid = 'Slideshow-' + $time();
    this.slideshow.set({'aria-live': 'polite', 'role': 'widget', 'styles': {'display': 'block', 'position': 'relative', 'z-index': 0}});
    if (!this.slideshow.get('id'))
      this.slideshow.set('id', this.uid);
    this.counter = this.delay = this.transition = 0;
    this.direction = 'left';
    this.paused = false;
    if (!this.options.overlap)
      this.options.duration *= 2;
    var anchor = this.slideshow.getElement('a') || new Element('a');
    if (!this.options.href)
      this.options.href = anchor.get('href') || '';
    if (this.options.hu.length && !this.options.hu.test(/\/$/)) 
      this.options.hu += '/';
    if (this.options.fast === true)
      this.options.fast = 2;
      
    // styles
    
    var keys = ['slideshow', 'first', 'prev', 'play', 'pause', 'next', 'last', 'images', 'captions', 'controller', 'thumbnails', 'hidden', 'visible', 'inactive', 'active', 'loader'];
    var values = keys.map(function(key, i){
      return this.options.classes[i] || key;
    }, this);
    this.classes = values.associate(keys);
    this.classes.get = function(){
      var str = '.' + this.slideshow;
      for (var i = 0, l = arguments.length; i < l; i++)
        str += ('-' + this[arguments[i]]);
      return str;
    }.bind(this.classes);
          
    // events
    
    this.events = new Hash();
    this.events.push = function(type, fn){
      if (!this[type])
        this[type] = [];
      this[type].push(fn);
      document.addEvent(type, fn);
    }.bind(this.events);
    
    this.accesskeys = new Hash();
    $H(this.options.accesskeys).each(function(obj, action){
      this.accesskeys[action] = accesskey = {'label': obj.label};
      ['shift', 'control', 'alt', 'meta'].each(function(modifier){
        var re = new RegExp(modifier, 'i');
        accesskey[modifier] = obj.key.test(re);
        obj.key = obj.key.replace(re, '');
      });
      accesskey.key = obj.key.trim();
    }, this);

    this.events.push('keyup', function(e){
      this.accesskeys.each(function(accesskey, action){
        if (e.key == accesskey.key && e.shift == accesskey.shift && e.control == accesskey.control && e.alt == accesskey.alt && e.meta == accesskey.meta)
          this[action]();
      }, this);      
    }.bind(this));   

    // data  
      
    if (!data){
      this.options.hu = '';
      data = {};
      var thumbnails = this.slideshow.getElements(this.classes.get('thumbnails') + ' img');
      this.slideshow.getElements(this.classes.get('images') + ' img').each(function(img, i){
        var caption = $pick(img.get('alt'), img.get('title'), '');
        var href = '';
        var thumbnail = thumbnails[i] ? thumbnails[i].get('src') : '';
        var parent = img.getParent();
        if (parent.get('tag') == 'a') {
          caption = $pick(caption, parent.get('title'), '');          
          href = parent.get('href');
        }
        data[img.get('src')] = {'caption': caption, 'href': href, 'thumbnail': thumbnail};
      });
    }

    // load data
    
    var loaded = this.load(data);
    if (!loaded)
      return;     

    // required elements
      
    var div = this.slideshow.getElement(this.classes.get('images'));
    var images = div ? div.empty() 
      : new Element('div', {'class': this.classes.get('images').substr(1)}).inject(this.slideshow);
    imagesSize = images.getSize();
    this.height = this.options.height || imagesSize.y;    
    this.width = this.options.width || imagesSize.x;
    images.set({
      'aria-busy': false,
      'role': 'img',
      'styles': {'display': 'block', 'height': this.height, 'overflow': 'hidden', 'position': 'relative', 'width': this.width}
    });
    this.slideshow.store('images', images);
    
    this.a = this.image = this.slideshow.getElement('img') || new Element('img');
    if (Browser.Engine.trident && Browser.Engine.version > 4)
      this.a.style.msInterpolationMode = 'bicubic';
    this.a.set({'aria-hidden': false, 'styles': {'display': 'none', 'position': 'absolute', 'zIndex': 1}});
    this.b = this.a.clone();
    [this.a, this.b].each(function(img){
      anchor.clone().cloneEvents(anchor).grab(img).inject(images);
    });    
      
    // optional elements
    
    if (this.options.captions)
       this._captions();
    if (this.options.controller)
      this._controller();
    if (this.options.loader)
       this._loader();
    if (this.options.thumbnails)
      this._thumbnails();
      
    // setup first slide  
      
    this.slide = this.options.slide;
    var match = window.location.href.match(this.options.match);
    if (this.options.match && match){
      if (this.data.images.contains(match[1]))
        this.slide = this.data.images.indexOf(match[1]);
      else if ($type(match[1].toInt()) == 'number')
        this.slide = match[1] % this.data.images.length;
    }

    // begin show
    
    this._preload();
  },
  
  /**
  Public method: go
    Jump directly to a slide in the show.

  Arguments:
    n - (integer) The index number of the image to jump to, 0 being the first image in the show.
    direction - (string) The direction the slideshow animates, either right or left.
  
  Syntax:
    myShow.go(n);  
  */

  go: function(n, direction){
    if ((this.slide - 1 + this.data.images.length) % this.data.images.length == n || $time() < this.transition)
      return;    
    $clear(this.timer);
    this.delay = 0;    
    this.direction = direction ? direction 
      : ((n < this.slide) ? 'right' : 'left');
    this.slide = n;
    if (this.preloader) 
      this.preloader = this.preloader.destroy();
    this._preload(this.options.fast == 2 || (this.options.fast == 1 && this.paused));
  },

  /**
  Public method: first
    Goes to the first image in the show.

  Syntax:
    myShow.first();  
  */

  first: function(){
    this.prev(true); 
  },

  /**
  Public method: prev
    Goes to the previous image in the show.

 Arguments:
   first - (undefined or true) Go to first frame instead of previous.
 
  Syntax:
    myShow.prev();  
  */

  prev: function(first){
    var n = 0;
    if (!first){
      if (this.options.random){
        
        // if it's a random show get the previous slide from the showed array

        if (this.showed.i < 2)
          return;
        this.showed.i -= 2;
        n = this.showed.array[this.showed.i];
      }
      else
        n = (this.slide - 2 + this.data.images.length) % this.data.images.length;                  
    }
    this.go(n, 'right');
  },

  /**
  Public method: pause
    Toggles play / pause state of the show.

  Arguments:
    p - (undefined, 1 or 0) Call pause with no arguments to toggle the pause state. Call pause(1) to force pause, or pause(0) to force play.

  Syntax:
    myShow.pause(p);  
  */

  pause: function(p){
    if ($chk(p))
      this.paused = p ? false : true;
    if (this.paused){
      this.paused = false;
      this.delay = this.state.delay;
      this.transition = this.state.transition;    
      this.timer = this._preload.delay(100, this);
      [this.a, this.b].each(function(img){
        ['morph', 'tween'].each(function(p){
          if (this.retrieve(p)) this.get(p).resume();
        }, img);
      });
      if (this.options.controller)
        this.slideshow.retrieve('pause').removeClass(this.classes.play);
    } 
    else {
      this.paused = true;
      this.state = {'delay': this.delay, 'transition': this.transition};
      this.delay = Number.MAX_VALUE;
      this.transition = 0;
      $clear(this.timer);
      [this.a, this.b].each(function(img){
        ['morph', 'tween'].each(function(p){
          if (this.retrieve(p)) this.get(p).pause();
        }, img);
      });
      if (this.options.controller)
        this.slideshow.retrieve('pause').addClass(this.classes.play);
    }
  },
  
  /**
  Public method: next
    Goes to the next image in the show.

  Arguments:
    last - (undefined or true) Go to last frame instead of next.

  Syntax:
    myShow.next();  
  */

  next: function(last){
    var n = last ? this.data.images.length - 1 : this.slide;
    this.go(n, 'left');
  },

  /**
  Public method: last
    Goes to the last image in the show.

  Syntax:
    myShow.last();  
  */

  last: function(){
    this.next(true); 
  },

  /**
  Public method: load
    Loads a new data set into the show: will stop the current show, rewind and rebuild thumbnails if applicable.

  Arguments:
    data - (array or object) The images and optional thumbnails, captions and links for the show.

  Syntax:
    myShow.load(data);
  */

  load: function(data){
    this.firstrun = true;
    this.showed = {'array': [], 'i': 0};
    if ($type(data) == 'array'){
      this.options.captions = false;      
      data = new Array(data.length).associate(data.map(function(image, i){ return image + '?' + i; })); 
    }
    this.data = {'images': [], 'captions': [], 'hrefs': [], 'thumbnails': [], 'titles': []};
    for (var image in data){
      if (data.hasOwnProperty(image)){
        var obj = data[image] || {};
        var caption = obj.caption ? obj.caption.trim() : '';
        var href = obj.href ? obj.href.trim() 
          : (this.options.linked ? this.options.hu + image 
          : this.options.href);
        var thumbnail = obj.thumbnail ? obj.thumbnail.trim() 
          : image.replace(this.options.replace[0], this.options.replace[1]);
        var title = caption ? caption.replace(/<.+?>/gm, '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, "'") : '';
        this.data.images.push(image);
        this.data.captions.push(caption);
        this.data.hrefs.push(href);
        this.data.thumbnails.push(thumbnail);
        this.data.titles.push(title);
      }      
    }
    if (this.options.random)
      this.slide = $random(0, this.data.images.length - 1);
    if (this.options.preload){
      this.data.images.each(function(image){
        new Asset.image(this.options.hu + image);
      }, this);
    }
    
    // only run when data is loaded dynamically into an existing slideshow instance
    
    if (this.options.thumbnails && this.slideshow.retrieve('thumbnails'))
      this._thumbnails();
    if (this.slideshow.retrieve('images')){
      [this.a, this.b].each(function(img){
        ['morph', 'tween'].each(function(p){
          if (this.retrieve(p)) this.get(p).cancel();
        }, img);
      });
      this.slide = this.transition = 0;
      this.go(0);    
    }
    return this.data.images.length;
  },
  
  /**
  Public method: destroy
    Destroys a Slideshow instance.

  Arguments:
    p - (string) The images and optional thumbnails, captions and links for the show.

  Syntax:
    myShow.destroy(p);
  */

  destroy: function(p){
    this.events.each(function(arr, e){
      if ($type(arr) == 'array')
        arr.each(function(fn){ document.removeEvent(e, fn); });
    });
    this.pause(1);
    if (this.options.loader)
      $clear(this.slideshow.retrieve('loader').retrieve('timer'));    
    if (this.options.thumbnails)
      $clear(this.slideshow.retrieve('thumbnails').retrieve('timer'));
    if (p){
      if (p == 'reset')
        this.slideshow.set('html', this.slideshow.retrieve('html'));
      else
        this.slideshow[p]();
    }
    this.slideshow.uid = Native.UID++; // once the internal ID is changed the pointer to all stored data is broken
  },
  
  /**
  Private method: preload
    Preloads the next slide in the show, once loaded triggers the show, updates captions, thumbnails, etc.
    
  Arguments:
    fast - (boolean) Whether the slideshow operates in fast-mode or not.
  */

  _preload: function(fast){
    if (!this.preloader)
       this.preloader = new Asset.image(this.options.hu + this.data.images[this.slide], {
        'onerror': function(){
          ['images', 'captions', 'hrefs', 'titles'].each(function(key){
            this.data[key].splice(this.slide, 1);
          }, this);
          if (this.options.thumbnails && this.slideshow.retrieve('thumbnails')){
            $(thumbnails.retrieve('uid') + this.slide).destroy();
            if (!this.data.thumbnails.length)
              this.slideshow.retrieve('thumbnails').fireEvent('resize');
          }
          this.preloader = this.preloader.destroy();
          this._preload();
        }.bind(this),
        'onload': function(){
          this.store('loaded', true);
        }
      });  
    if (this.preloader.retrieve('loaded') && $time() > this.delay && $time() > this.transition){
      if (this.stopped){
        if (this.options.captions)
          this.slideshow.retrieve('captions').get('morph').cancel().start(this.classes.get('captions', 'hidden'));
        this.pause(1);
        if (this.end)
          this.fireEvent('end');
        this.stopped = this.end = false;
        return;        
      }          
      this.image = (this.counter % 2) ? this.b : this.a;
      this.image.set('styles', {'display': 'block', 'height': 'auto', 'visibility': 'hidden', 'width': 'auto', 'zIndex': this.counter});
      ['src', 'height', 'width'].each(function(prop){
        this.image.set(prop, this.preloader.get(prop));
      }, this);
      this._resize(this.image);
      this._center(this.image);
      var anchor = this.image.getParent();
      if (this.data.hrefs[this.slide])
        anchor.set('href', this.data.hrefs[this.slide])
      else
        anchor.erase('href');
      if (this.options.titles) {
        this.image.set('alt', this.data.titles[this.slide]);    
        anchor.set('title', this.data.titles[this.slide]);
      }
      if (this.options.loader)
        this.slideshow.retrieve('loader').fireEvent('hide');
      if (this.options.captions)
        this.slideshow.retrieve('captions').fireEvent('update', fast);        
      if (this.options.thumbnails)
        this.slideshow.retrieve('thumbnails').fireEvent('update', fast);       
      this._show(fast);
      this._loaded();
    } 
    else {
      if ($time() > this.delay && this.options.loader)
        this.slideshow.retrieve('loader').fireEvent('show');
      this.timer = (this.paused && this.preloader.retrieve('loaded')) ? null 
        : this._preload.delay(100, this, fast); 
    }
  },

  /**
  Private method: show
    Does the slideshow effect.

  Arguments:
    fast - (boolean) Whether the slideshow operates in fast-mode or not.
  */

  _show: function(fast){
    if (!this.image.retrieve('morph')){
      var options = this.options.overlap ? {'duration': this.options.duration, 'link': 'cancel'} 
        : {'duration': this.options.duration / 2, 'link': 'chain'};
      $$(this.a, this.b).set('morph', $merge(options, {'onStart': this._start.bind(this), 'onComplete': this._complete.bind(this), 'transition': this.options.transition}));
    }
    var hidden = this.classes.get('images', ((this.direction == 'left') ? 'next' : 'prev'));
    var visible = this.classes.get('images', 'visible');
    var img = (this.counter % 2) ? this.a : this.b;
    if (fast){      
      img.set('aria-hidden', true).get('morph').cancel().set(hidden);
      this.image.set('aria-hidden', false).get('morph').cancel().set(visible);       
    } 
    else {
      if (this.options.overlap){
        img.get('morph').set(visible);
        this.image.get('morph').set(hidden).start(visible);
      } 
      else  {
        var fn1 = function(img, hidden, visible){
          img.set({'aria-busy': false, 'aria-hidden': true});
          this.image.set({'aria-busy': true}).get('morph').set(hidden).start(visible);
        }.pass([img, hidden, visible], this);
        var fn2 = function(){
          this.image.set({'aria-busy': false, 'aria-hidden': false});
        }.bind(this);
        hidden = this.classes.get('images', ((this.direction == 'left') ? 'prev' : 'next'));
        img.set('aria-busy', true).get('morph').set(visible).start(hidden).chain(fn1, fn2);
      }
    }
  },

  /**
  Private method: loaded
    Run after the current image has been loaded, sets up the next image to be shown.
  */

  _loaded: function(){
    this.counter++;
    this.delay = this.paused ? Number.MAX_VALUE : $time() + this.options.duration + this.options.delay;
    this.direction = 'left';
    this.transition = (this.options.fast == 2 || (this.options.fast == 1 && this.paused)) ? 0 : $time() + this.options.duration;      
    if (this.slide + 1 == this.data.images.length && !this.options.loop && !this.options.random)
      this.stopped = this.end = true;      
    if (this.options.random){
      this.showed.i++;
      if (this.showed.i >= this.showed.array.length){
        var n = this.slide;
        if (this.showed.array.getLast() != n) this.showed.array.push(n);
        while (this.slide == n)
          this.slide = $random(0, this.data.images.length - 1);        
      }
      else
        this.slide = this.showed.array[this.showed.i];
    }
    else
      this.slide = (this.slide + 1) % this.data.images.length;
    if (this.image.getStyle('visibility') != 'visible')
      (function(){ this.image.setStyle('visibility', 'visible'); }).delay(1, this);      
    if (this.preloader) 
      this.preloader = this.preloader.destroy();
    this._preload();
  },

  /**
  Private method: center
    Center an image.

  Arguments:
    img - (element) Image that the transform is applied to.
  */

  _center: function(img){
    if (this.options.center){
      var h = img.get('height'), w = img.get('width');
      img.set('styles', {'left': (w - this.width) / -2, 'top': (h - this.height) / -2});
    }
  },

  /**
  Private method: resize
    Resizes an image.

  Arguments:
    img - (element) Image that the transform is applied to.
  */

  _resize: function(img){
    if (this.options.resize){
      var h = this.preloader.get('height'), w = this.preloader.get('width');
      var dh = this.height / h, dw = this.width / w, d;
      if (this.options.resize == 'length')
        d = (dh > dw) ? dw : dh;
      else
        d = (dh > dw) ? dh : dw;
      img.set('styles', {height: Math.ceil(h * d), width: Math.ceil(w * d)});
    }  
  },

  /**
  Private method: start
    Callback on start of slide change.
  */

  _start: function(){    
    this.fireEvent('start');
  },

  /**
  Private method: complete
    Callback on start of slide change.
  */

  _complete: function(){
    if (this.firstrun && this.options.paused){
      this.firstrun = false;
      this.pause(1);
    }
    this.fireEvent('complete');
  },

  /**
  Private method: captions
    Builds the optional caption element, adds interactivity.
    This method can safely be removed if the captions option is not enabled.
  */

  _captions: function(){
     if (this.options.captions === true) 
       this.options.captions = {};
    var el = this.slideshow.getElement(this.classes.get('captions'));
    var captions = el ? el.empty() 
      : new Element('div', {'class': this.classes.get('captions').substr(1)}).inject(this.slideshow);
    captions.set({
      'aria-busy': false,
      'aria-hidden': false,
      'events': {
        'update': function(fast){  
          var captions = this.slideshow.retrieve('captions');
          var empty = (this.data.captions[this.slide] === '');
          if (fast){
            var p = empty ? 'hidden' : 'visible';
            captions.set({'aria-hidden': empty, 'html': this.data.captions[this.slide]}).get('morph').cancel().set(this.classes.get('captions', p));
          }
          else {
            var fn1 = empty ? $empty : function(n){
              this.slideshow.retrieve('captions').set('html', this.data.captions[n]).morph(this.classes.get('captions', 'visible'));
            }.pass(this.slide, this);    
            var fn2 = function(){ 
              this.slideshow.retrieve('captions').set('aria-busy', false); 
            }.bind(this);
            captions.set('aria-busy', true).get('morph').cancel().start(this.classes.get('captions', 'hidden')).chain(fn1, fn2);
          }
        }.bind(this)
      },
      'morph': $merge(this.options.captions, {'link': 'chain'}),
      'role': 'description'
    });
    if (!captions.get('id'))
      captions.set('id', 'Slideshow-' + $time());
    this.slideshow.retrieve('images').set('aria-labelledby', captions.get('id'));
    this.slideshow.store('captions', captions);
  },

  /**
  Private method: controller
    Builds the optional controller element, adds interactivity.
    This method can safely be removed if the controller option is not enabled.
  */

  _controller: function(){
    if (this.options.controller === true)
       this.options.controller = {};
    var el = this.slideshow.getElement(this.classes.get('controller'));
    var controller = el ? el.empty() : new Element('div', {'class': this.classes.get('controller').substr(1)}).inject(this.slideshow);
    controller.set({'aria-hidden': false, 'role': 'menubar'});
    var ul = new Element('ul', {'role': 'menu'}).inject(controller);
    var i = 0;
    this.accesskeys.each(function(accesskey, action){
      var li = new Element('li', {
        'class': (action == 'pause' && this.options.paused) ? this.classes.play + ' ' + this.classes[action] : this.classes[action]
      }).inject(ul);
      var a = this.slideshow.retrieve(action, new Element('a', {
        'role': 'menuitem', 'tabindex': i++, 'title': accesskey.label
      }).inject(li));
      a.set('events', {
        'click': function(action){this[action]();}.pass(action, this),
        'mouseenter': function(active){this.addClass(active);}.pass(this.classes.active, a),
        'mouseleave': function(active){this.removeClass(active);}.pass(this.classes.active, a)
      });    
    }, this);
    controller.set({
      'events': {
        'hide': function(hidden){  
          if (!this.get('aria-hidden'))
            this.set('aria-hidden', true).morph(hidden);
        }.pass(this.classes.get('controller', 'hidden'), controller),
        'show': function(visible){  
          if (this.get('aria-hidden'))
            this.set('aria-hidden', false).morph(visible);
        }.pass(this.classes.get('controller', 'visible'), controller)
      },
      'morph': $merge(this.options.controller, {'link': 'cancel'})
    }).store('hidden', false);
    this.events.push('keydown', function(e){
      this.accesskeys.each(function(accesskey, action){
        if (e.key == accesskey.key && e.shift == accesskey.shift && e.control == accesskey.control && e.alt == accesskey.alt && e.meta == accesskey.meta){
          var controller = this.slideshow.retrieve('controller');
          if (controller.get('aria-hidden'))
            controller.get('morph').set(this.classes.get('controller', 'visible'));
          this.slideshow.retrieve(action).fireEvent('mouseenter');
        }          
      }, this);      
    }.bind(this));
    this.events.push('keyup', function(e){
      this.accesskeys.each(function(accesskey, action){
        if (e.key == accesskey.key && e.shift == accesskey.shift && e.control == accesskey.control && e.alt == accesskey.alt && e.meta == accesskey.meta){
          var controller = this.slideshow.retrieve('controller');
          if (controller.get('aria-hidden'))
            controller.set('aria-hidden', false).fireEvent('hide'); 
          this.slideshow.retrieve(action).fireEvent('mouseleave');
        }          
      }, this);      
    }.bind(this));
    this.events.push('mousemove', function(e){
      var images = this.slideshow.retrieve('images').getCoordinates();
      var action = (e.page.x > images.left && e.page.x < images.right && e.page.y > images.top && e.page.y < images.bottom) ? 'show' : 'hide';
      this.slideshow.retrieve('controller').fireEvent(action);
    }.bind(this));
    this.slideshow.retrieve('controller', controller).fireEvent('hide');
  },  

  /**
  Private method: loader
    Builds the optional loader element, adds interactivity.
    This method can safely be removed if the loader option is not enabled.
  */

  _loader: function(){
    if (this.options.loader === true) 
       this.options.loader = {};
    var loader = new Element('div', {
      'aria-hidden': false,
      'class': this.classes.get('loader').substr(1),        
      'morph': $merge(this.options.loader, {'link': 'cancel'}),
      'role': 'progressbar'
    }).store('animate', false).store('i', 0).inject(this.slideshow.retrieve('images'));
    var url = loader.getStyle('backgroundImage').replace(/url\(['"]?(.*?)['"]?\)/, '$1');
    if (url){
      if (url.test(/\.apng$/) && !(Browser.Engine.gecko19 || Browser.Engine.presto950))
        url = url.replace(/(.*?)\.apng$/, '$1.png');
      if (url.test(/\.png$/)){
        if (Browser.Engine.trident4)
          loader.setStyles({'backgroundImage': 'none', 'filter': 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + url + '", sizingMethod="crop")'});          
        new Asset.image(url, {'onload': function() {
          var size = loader.getSize(), w = this.get('width'), h = this.get('height'), img = url.split('/').pop();
          if (w > size.x)
            loader.store('animate', 'x').store('frames', (w / size.x).toInt());
          else if (h > size.y)
            loader.store('animate', 'y').store('frames', (h / size.y).toInt());
          else if (img.test(/\d+/))
            loader.store('animate', url).store('frames', 1).fireEvent('preload');
        }});
      }
    }
    loader.set('events', {
      'animate': function(){  
        var loader = this.slideshow.retrieve('loader'), animate = loader.retrieve('animate');        
        var i = (loader.retrieve('i').toInt() + 1) % loader.retrieve('frames');
        loader.store('i', i);
        if (animate == 'x')
          loader.setStyle('backgroundPosition', (i * loader.getSize().x) + ' 0');
        else if (animate == 'y')
          loader.setStyle('backgroundPosition', '0 ' + (i * loader.getSize().y));
        else { // animate frames
          url = animate.split('/');
          var img = url.pop().replace(/\d+/, i);
          url = url.push(img).join('/');
          if (Browser.Engine.trident4)
            loader.setStyle('filter', 'progid:DXImageTransform.Microsoft.AlphaImageLoader(src="' + url + '", sizingMethod="scale")');
          else 
            loader.setStyle('backgroundImage', 'url(' + url + ')');
        }  
      }.bind(this),
      'hide': function(){  
        var loader = this.slideshow.retrieve('loader');
        if (!loader.get('aria-hidden')){
          loader.set('aria-hidden', true).morph(this.classes.get('loader', 'hidden'));
          if (loader.retrieve('animate'))
            $clear(loader.retrieve('timer'));          
        }
      }.bind(this),
      'preload': function(){
        var loader = this.slideshow.retrieve('loader'), url = loader.retrieve('animate').split('/');
        var img = url.pop().replace(/\d+/, loader.retrieve('frames') + 1);
        url = url.push(img).join('/');
        new Asset.image(url, {'onload': function(){
          this.store('frames', this.retrieve('frames') + 1).fireEvent('preload');
        }.bind(loader) });
      }.bind(this),
      'show': function(){  
        var loader = this.slideshow.retrieve('loader');
        if (loader.get('aria-hidden')){
          loader.set('aria-hidden', false).morph(this.classes.get('loader', 'visible'));
          if (loader.retrieve('animate'))
            loader.store('timer', function(){this.fireEvent('animate');}.periodical(50, loader));
        }
      }.bind(this)
    });
    this.slideshow.retrieve('loader', loader).fireEvent('hide');
  },
  
  /**
  Private method: thumbnails
    Builds the optional thumbnails element, adds interactivity.
    This method can safely be removed if the thumbnails option is not enabled.
  */

  _thumbnails: function() {
    if (this.options.thumbnails === true) 
       this.options.thumbnails = {}; 
    var el = this.slideshow.getElement(this.classes.get('thumbnails'));
    var thumbnails = el ? el.empty() : new Element('div', {'class': this.classes.get('thumbnails').substr(1)}).inject(this.slideshow);
    thumbnails.set({'role': 'menubar', 'styles': {'overflow': 'hidden'}});
    var uid = thumbnails.retrieve('uid', 'Slideshow-' + $time());
    var ul = new Element('ul', {'role': 'menu', 'styles': {'left': 0, 'position': 'absolute', 'top': 0}, 'tween': {'link': 'cancel'}}).inject(thumbnails);
    this.data.thumbnails.each(function(thumbnail, i){
      var li = new Element('li', {'id': uid + i}).inject(ul);
      var a = new Element('a', {
        'class': this.classes.get('thumbnails', 'hidden').substr(1),
        'events': {
          'click': function(i){
            this.go(i); 
            return false; 
          }.pass(i, this)
        },
        'href': this.options.hu + this.data.images[i],
        'morph': $merge(this.options.thumbnails, {'link': 'cancel'}),
        'role': 'menuitem',
        'tabindex': i
      }).store('uid', i).inject(li);
      if (this.options.titles)
        a.set('title', this.data.titles[i]);
      new Asset.image(this.options.hu + thumbnail, {
        'onload': function(i){
          var thumbnails = this.slideshow.retrieve('thumbnails');
          var a = thumbnails.getElements('a')[i];
          if (a){
            (function(a){              
              a.store('loaded', true).get('morph').set(this.classes.get('thumbnails', 'hidden')).start(this.classes.get('thumbnails', 'inactive'));  
            }).delay(50 * i, this, a);
          }          
          if (thumbnails.retrieve('limit'))
            return;
          var props = thumbnails.retrieve('props'), options = this.options.thumbnails;
          var pos = props[1], length = props[2], width = props[4]; 
          var li = thumbnails.getElement('li:nth-child(' + (i + 1) + ')').getCoordinates();
          if (options.columns || options.rows){
            thumbnails.setStyles({'height': this.height, 'width': this.width});
            if (options.columns.toInt())
              thumbnails.setStyle('width', li.width * options.columns.toInt());
            if (options.rows.toInt())
              thumbnails.setStyle('height', li.height * options.rows.toInt());
          }
          var div = thumbnails.getCoordinates();
          if (options.position){
            if (options.position.test(/bottom|top/))
              thumbnails.setStyles({'bottom': 'auto', 'top': 'auto'}).setStyle(options.position, -div.height);
            if (options.position.test(/left|right/))
              thumbnails.setStyles({'left': 'auto', 'right': 'auto'}).setStyle(options.position, -div.width);
          }
          var n = Math.floor(div[width] / li[width]); // number of rows or columns
          var x = Math.ceil(this.data.images.length / n); // number of images per row or column
          var r = this.data.images.length % n; // remainder
          var len = x * li[length]; // length of a single row or column
          var ul = thumbnails.getElement('ul').setStyle(length, len);
          var lis = ul.getElements('li').setStyles({'height': li.height, 'width': li.width});
          if (options.scroll == 'y'){ // for vertical scrolling we have to resort the thumbnails in the container
            ul.innerHTML = '';
            var counter = this.data.images.length;
            for (i = 0; i < x; i++){
              for (var j = 0; j < n; j++){
                if (!counter) break;
                counter--;
                var m = i + (x * j);
                if (j > r) m -= (j - r);
                lis[m].inject(ul);
              }
            }
          }
          thumbnails.store('limit', div[length] - len);
        }.pass(i, this)
      }).inject(a);
    }, this);
    thumbnails.set('events', {
      'scroll': function(n, fast){
        var div = this.getCoordinates();
        var ul = this.getElement('ul').getPosition();
        var props = this.retrieve('props');
        var axis = props[3], delta, pos = props[0], size = props[2], value;        
        var tween = this.getElement('ul').get('tween', {'property': pos});  
        if ($chk(n)){
          var uid = this.retrieve('uid');
          var li = $(uid + n).getCoordinates();
          delta = div[pos] + (div[size] / 2) - (li[size] / 2) - li[pos];
          value = (ul[axis] - div[pos] + delta).limit(this.retrieve('limit'), 0);
          if (fast)  
            tween.set(value);
          else             
            tween.start(value);
        }
        else{
          var area = div[props[2]] / 3, page = this.retrieve('page'), velocity = -0.2;      
          if (page[axis] < (div[pos] + area))
            delta = (page[axis] - div[pos] - area) * velocity;
          else if (page[axis] > (div[pos] + div[size] - area))
            delta = (page[axis] - div[pos] - div[size] + area) * velocity;      
          if (delta){      
            value = (ul[axis] - div[pos] + delta).limit(this.retrieve('limit'), 0);
            tween.set(value);
          }
        }        
      }.bind(thumbnails),
      'update': function(fast){
        var thumbnails = this.slideshow.retrieve('thumbnails');
        var uid = thumbnails.retrieve('uid');
        thumbnails.getElements('a').each(function(a, i){
          if (a.retrieve('loaded')){
            if (a.retrieve('uid') == this.slide){
              if (!a.retrieve('active', false)){
                a.store('active', true);
                var active = this.classes.get('thumbnails', 'active');              
                if (fast) a.get('morph').set(active);
                else a.morph(active);
              }
            } 
            else {
              if (a.retrieve('active', true)){
                a.store('active', false);
                var inactive = this.classes.get('thumbnails', 'inactive');            
                if (fast) a.get('morph').set(inactive);
                else a.morph(inactive);
              }
            }
          }
        }, this);
        if (!thumbnails.retrieve('mouseover'))
          thumbnails.fireEvent('scroll', [this.slide, fast]);
      }.bind(this)
    });
    var coords = thumbnails.getCoordinates();
    if (!this.options.thumbnails.scroll)
      this.options.thumbnails.scroll = (coords.height > coords.width) ? 'y' : 'x';
    var props = (this.options.thumbnails.scroll == 'y') ? ['top', 'bottom', 'height', 'y', 'width'] 
      : ['left', 'right', 'width', 'x', 'height'];
    thumbnails.store('props', props);
    this.events.push('mousemove', function(e){
      var coords = this.getCoordinates();
      if (e.page.x > coords.left && e.page.x < coords.right && e.page.y > coords.top && e.page.y < coords.bottom){
        this.store('page', e.page);      
        if (!this.retrieve('mouseover')){
          this.store('mouseover', true);
          this.store('timer', function(){this.fireEvent('scroll');}.periodical(50, this));
        }
      }
      else {
        if (this.retrieve('mouseover')){
          this.store('mouseover', false);        
          $clear(this.retrieve('timer'));
        }
      }      
    }.bind(thumbnails));
    this.slideshow.store('thumbnails', thumbnails);  
  }
});