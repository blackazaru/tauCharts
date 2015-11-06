import {default as _} from 'underscore';
import {FormatterRegistry} from './formatter-registry';

class PluginsSDK {

    static unit(unitRef) {

        return {

            value: function () {
                return unitRef;
            },

            clone: function () {
                return PluginsSDK.cloneObject(unitRef);
            },

            traverse: function (iterator) {

                var fnTraverse = (node, fnIterator, parentNode) => {
                    fnIterator(node, parentNode);
                    (node.units || []).map((x) => fnTraverse(x, fnIterator, node));
                };

                fnTraverse(unitRef, iterator, null);
                return this;
            },

            reduce: function (iterator, memo) {
                var r = memo;
                this.traverse((unit, parent) => (r = iterator(r, unit, parent)));
                return r;
            },

            addFrame: function (frameConfig) {
                unitRef.frames = unitRef.frames || [];

                frameConfig.key.__layerid__ = ['L', (+new Date()), unitRef.frames.length].join('');
                frameConfig.source = (frameConfig.hasOwnProperty('source') ?
                    (frameConfig.source) :
                    (unitRef.expression.source));

                frameConfig.pipe = frameConfig.pipe || [];

                unitRef.frames.push(frameConfig);
                return this;
            },

            addTransformation: function (name, params) {
                unitRef.transformation = unitRef.transformation || [];
                unitRef.transformation.push({type: name, args: params});
                return this;
            },

            isCoordinates: function () {
                return ((unitRef.type || '').toUpperCase().indexOf('COORDS.') === 0);
            },

            isElementOf: function (typeOfCoordinates) {

                if (this.isCoordinates()) {
                    return false;
                }

                var xType = (unitRef.type || '');
                var parts = (xType.split('/'));

                if (parts.length === 1) {
                    parts.unshift('RECT'); // by default
                }

                return (parts[0].toUpperCase() === typeOfCoordinates.toUpperCase());
            }
        };
    }

    static spec(specRef) {

        return {

            value: function () {
                return specRef;
            },

            unit: function (newUnit) {
                if (newUnit) {
                    specRef.unit = newUnit;
                }
                return PluginsSDK.unit(specRef.unit);
            },

            addTransformation: function (name, func) {
                specRef.transformations = specRef.transformations || {};
                specRef.transformations[name] = func;
                return this;
            },

            getSettings: function (name) {
                return specRef.settings[name];
            },

            setSettings: function (name, value) {
                specRef.settings = specRef.settings || {};
                specRef.settings[name] = value;
                return this;
            },

            getScale: function (name) {
                return specRef.scales[name];
            },

            addScale: function (name, props) {
                specRef.scales[name] = props;
                return this;
            },

            regSource: function (sourceName, sourceObject) {
                specRef.sources[sourceName] = sourceObject;
                return this;
            },

            getSourceData: function (sourceName) {
                var srcData = specRef.sources[sourceName] || {data:[]};
                return srcData.data;
            },

            getSourceDim: function (sourceName, sourceDim) {
                var srcDims = specRef.sources[sourceName] || {dims:{}};
                return srcDims.dims[sourceDim] || {};
            }
        };
    }

    static cloneObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    static depthFirstSearch(node, predicate) {
        if (predicate(node)) {
            return node;
        }
        var i, children = node.units || [], child, found;
        for (i = 0; i < children.length; i += 1) {
            child = children[i];
            found = PluginsSDK.depthFirstSearch(child, predicate);
            if (found) {
                return found;
            }
        }
    }

    static traverseSpec(spec, iterator) {

        var traverse = (node, fnIterator, parentNode) => {
            fnIterator(node, parentNode);
            (node.units || []).map((x) => traverse(x, fnIterator, node));
        };

        traverse(spec.unit, iterator, null);
    }

    static extractFieldsFormatInfo(spec) {

        var specScales = spec.scales;

        var isEmptyScale = function (key) {
            return !specScales[key].dim;
        };

        var fillSlot = function (memoRef, config, key) {
            var GUIDE = config.guide || {};
            var scale = specScales[config[key]];
            var guide = GUIDE[key] || {};
            memoRef[scale.dim] = memoRef[scale.dim] || {label: [], format: [], nullAlias:[], tickLabel:[]};

            var label = guide.label;
            var guideLabel = (guide.label || {});
            memoRef[scale.dim].label.push(_.isString(label) ?
                    (label) :
                    (guideLabel._original_text || guideLabel.text)
            );

            var format = guide.tickFormat || guide.tickPeriod;
            memoRef[scale.dim].format.push(format);

            memoRef[scale.dim].nullAlias.push(guide.tickFormatNullAlias);

            // TODO: workaround for #complex-objects
            memoRef[scale.dim].tickLabel.push(guide.tickLabel);
        };

        var configs = [];
        PluginsSDK.traverseSpec(spec, function (node) {
            configs.push(node);
        });

        var summary = configs.reduce(function (memo, config) {

            if (config.type === 'COORDS.RECT' && config.hasOwnProperty('x') && !isEmptyScale(config.x)) {
                fillSlot(memo, config, 'x');
            }

            if (config.type === 'COORDS.RECT' && config.hasOwnProperty('y') && !isEmptyScale(config.y)) {
                fillSlot(memo, config, 'y');
            }

            if (config.hasOwnProperty('color') && !isEmptyScale(config.color)) {
                fillSlot(memo, config, 'color');
            }

            if (config.hasOwnProperty('size') && !isEmptyScale(config.size)) {
                fillSlot(memo, config, 'size');
            }

            return memo;

        }, {});

        var choiceRule = function (arr, defaultValue) {

            var val = _(arr)
                .chain()
                .filter(_.identity)
                .uniq()
                .first()
                .value();

            return val || defaultValue;
        };

        return Object
            .keys(summary)
            .reduce(function (memo, k) {
                memo[k].label = choiceRule(memo[k].label, k);
                memo[k].format = choiceRule(memo[k].format, null);
                memo[k].nullAlias = choiceRule(memo[k].nullAlias, ('No ' + memo[k].label));
                memo[k].tickLabel = choiceRule(memo[k].tickLabel, null);

                // very special case for dates
                var format = (memo[k].format === 'x-time-auto') ? 'day' : memo[k].format;
                var nonVal = memo[k].nullAlias;
                var fnForm = format ?
                    (FormatterRegistry.get(format, nonVal)) :
                    (function (raw) {
                        return (raw === null) ? nonVal : raw;
                    });

                memo[k].format = fnForm;

                // TODO: workaround for #complex-objects
                if (memo[k].tickLabel) {
                    var kc = k.replace(('.' + memo[k].tickLabel), '');
                    memo[kc] = {
                        label: memo[k].label,
                        nullAlias: memo[k].nullAlias,
                        tickLabel: memo[k].tickLabel,
                        format: function (obj) {
                            return fnForm(obj && obj[memo[kc].tickLabel]);
                        },
                        isComplexField: true
                    };

                    memo[k].parentField = kc;
                }

                return memo;
            }, summary);
    }
}

export {PluginsSDK};