define(["durandal/system"],function(e){var t=/\s+/,i=function(){},n=function(e,t){this.owner=e,this.events=t};return n.prototype.then=function(e,t){return this.callback=e||this.callback,this.context=t||this.context,this.callback?(this.owner.on(this.events,this.callback,this.context),this):this},n.prototype.on=n.prototype.then,n.prototype.off=function(){return this.owner.off(this.events,this.callback,this.context),this},i.prototype.on=function(e,i,r){var a,o,c;if(i){for(a=this.callbacks||(this.callbacks={}),e=e.split(t);o=e.shift();)c=a[o]||(a[o]=[]),c.push(i,r);return this}return new n(this,e)},i.prototype.off=function(i,n,r){var a,o,c,s;if(!(o=this.callbacks))return this;if(!(i||n||r))return delete this.callbacks,this;for(i=i?i.split(t):e.keys(o);a=i.shift();)if((c=o[a])&&(n||r))for(s=c.length-2;s>=0;s-=2)n&&c[s]!==n||r&&c[s+1]!==r||c.splice(s,2);else delete o[a];return this},i.prototype.trigger=function(e){var i,n,r,a,o,c,s,l;if(!(n=this.callbacks))return this;for(l=[],e=e.split(t),a=1,o=arguments.length;o>a;a++)l[a-1]=arguments[a];for(;i=e.shift();){if((s=n.all)&&(s=s.slice()),(r=n[i])&&(r=r.slice()),r)for(a=0,o=r.length;o>a;a+=2)r[a].apply(r[a+1]||this,l);if(s)for(c=[i].concat(l),a=0,o=s.length;o>a;a+=2)s[a].apply(s[a+1]||this,c)}return this},i.prototype.proxy=function(e){var t=this;return function(i){t.trigger(e,i)}},i.includeIn=function(e){e.on=i.prototype.on,e.off=i.prototype.off,e.trigger=i.prototype.trigger,e.proxy=i.prototype.proxy},i});