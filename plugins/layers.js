// jscs:disable *
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['tauCharts'], function (tauPlugins) {
            return factory(tauPlugins);
        });
    } else if (typeof module === 'object' && module.exports) {
        var tauPlugins = require('tauCharts');
        module.exports = factory(tauPlugins);
    } else {
        factory(this.tauCharts);
    }
})(function (tauCharts) {

    var _ = tauCharts.api._;
    var pluginsSDK = tauCharts.api.pluginsSDK;

    function layers(xSettings) {

        var settings = _.defaults(
            xSettings || {},
            {
                hideError: false,
                showPanel: true,
                showLayers: true,
                mode: 'merge'
            });

        var ELEMENT_TYPE = {
            line: 'ELEMENT.LINE',
            area: 'ELEMENT.AREA',
            dots: 'ELEMENT.POINT',
            scatterplot: 'ELEMENT.POINT',
            bar: 'ELEMENT.INTERVAL',
            'stacked-bar': 'ELEMENT.INTERVAL.STACKED'
        };

        return {

            init: function (chart) {

                this._chart = chart;

                var spec = this._chart.getSpec();
                spec.settings.excludeNull = false;
                spec.settings.fitModel = null;

                if (settings.showPanel) {

                    this._container = chart.insertToRightSidebar(this.containerTemplate);
                    this._container.classList.add('applicable-true');
                    if (settings.hideError) {
                        this._container
                            .classList
                            .add('hide-trendline-error');
                    }

                    this.uiChangeEventsDispatcher = function (e) {

                        var target = e.target;
                        var selector = target.classList;

                        if (selector.contains('i-role-show-layers')) {
                            settings.showLayers = target.checked;
                        }

                        if (selector.contains('i-role-change-mode')) {
                            settings.mode = target.value;
                        }

                        this._chart.refresh();

                    }.bind(this);

                    this._container
                        .addEventListener('change', this.uiChangeEventsDispatcher, false);
                }
            },

            predicateIsElement: function (specRef, unit, parentUnit) {
                return (
                    (parentUnit)
                    &&
                    (parentUnit.type === 'COORDS.RECT')
                    &&
                    (unit.type !== 'COORDS.RECT')
                );
            },

            predicateIsCoord: function (specRef, coordsUnit, parentUnit) {
                return (
                    (coordsUnit)
                    &&
                    (coordsUnit.type === 'COORDS.RECT')
                    &&
                    (_.every(coordsUnit.units, function (subUnit) {
                        return subUnit.type !== 'COORDS.RECT';
                    }))
                );
            },

            buildLayersLayout: function (specRef, layers, layerInvoker) {

                specRef.transformations = specRef.transformations || {};
                specRef.transformations['defined-only'] = function (data, props) {
                    var k = props.key;
                    return _(data)
                        .chain()
                        .filter(function (row) {
                            return ((row[k] !== null) && (typeof (row[k]) !== 'undefined'));
                        })
                        .value();
                };

                specRef.sources['$'] = {
                    dims: {
                        x: {type: 'category'},
                        y: {type: 'category'}
                    },
                    data: [{x: 1, y: 1}]
                };

                specRef.scales['xLayoutScale'] = {type: 'ordinal', source: '$', dim: 'x'};
                specRef.scales['yLayoutScale'] = {type: 'ordinal', source: '$', dim: 'y'};

                var prevUnit = specRef.unit;
                var uid = ('ID' + (+ new Date()));
                specRef.unit = {
                    type: 'COORDS.RECT',
                    x: 'xLayoutScale',
                    y: 'yLayoutScale',
                    expression: {
                        source: '$',
                        inherit: false,
                        operator: false
                    },
                    guide: {
                        showGridLines: '',
                        x: {cssClass: 'facet-axis'},
                        y: {cssClass: 'facet-axis'}
                    },
                    frames: layers.reduce(
                        function (memo, item, i) {

                            var ii = (i + 1);

                            return memo.concat({
                                key: {x: 1, y: 1, id: (uid + ii)},
                                source: '$',
                                pipe: [],
                                units: [layerInvoker(pluginsSDK.cloneObject(prevUnit), ii, item)]
                            });
                        },
                        [
                            {
                                key: {x: 1, y: 1, id: (uid + 0)},
                                source: '$',
                                pipe: [],
                                units: [layerInvoker(pluginsSDK.cloneObject(prevUnit), 0, null)]
                            }
                        ])
                };
            },

            addTransformation: function (unit, transformationType, params) {
                unit.transformation = unit.transformation || [];
                unit.transformation.push({type: transformationType, args: params});
                return unit;
            },

            findPrimaryYScale: function (currUnit, specRef) {
                var self = this;
                var resY = [];
                this._chart.traverseSpec(
                    {unit: currUnit},
                    function (unit) {
                        if (self.predicateIsCoord(specRef, unit)) {
                            resY.push(unit.y);
                        }
                    });

                return _.uniq(resY)[0];
            },

            onSpecReady: function (chart, specRef) {

                var self = this;

                if (!settings.showLayers) {
                    return;
                }

                specRef.scales = settings.layers.reduce(
                    function (memo, l) {
                        memo[l.y] = {type: 'linear', source: '/', dim: l.y, autoScale: true};
                        return memo;
                    },
                    specRef.scales);

                var primaryY = self.findPrimaryYScale(specRef.unit, specRef);
                var scaleNames = _(settings.layers).pluck('y').concat(primaryY);
                var hashBounds = scaleNames.reduce(function (memo, yi) {
                        var info = self._chart.getScaleInfo(yi);
                        memo[yi] = info.domain().filter(function (n) {
                            return !isNaN(n) && _.isNumber(n);
                        });
                        return memo;
                    },
                    {});

                var currLayers = settings.layers.filter(function (l) {
                    return hashBounds[l.y].length > 0;
                });

                if (settings.mode === 'merge') {
                    var minMax = d3.extent(_(hashBounds).chain().values().flatten().value());
                    scaleNames.forEach(function (y) {
                        specRef.scales[y].min = minMax[0];
                        specRef.scales[y].max = minMax[1];
                        specRef.scales[y].autoScale = false;
                    });
                }

                self.buildLayersLayout(specRef, currLayers, function (currUnit, i, xLayer) {

                    var totalDif = (30);
                    var totalPad = (currLayers.length * totalDif) - totalDif;

                    if (i === 0) {
                        chart.traverseSpec(
                            {unit:currUnit},
                            function (unit, parentUnit) {

                                if (self.predicateIsElement(specRef, unit, parentUnit)) {
                                    self.addTransformation(unit, 'defined-only', {key: specRef.scales[unit.y].dim});
                                }

                                if (self.predicateIsCoord(specRef, unit)) {
                                    if (settings.mode === 'dock') {
                                        unit.guide.padding.l += totalPad;
                                        unit.guide.y.label.textAnchor = 'end';
                                        unit.guide.y.label.dock = 'right';
                                        unit.guide.y.label.padding = -10;
                                        unit.guide.y.label.cssClass = 'label inline';
                                    } else if (settings.mode === 'merge') {
                                        unit.guide.y.label = (unit.guide.y.label || {});
                                        unit.guide.y.label.text = [unit.guide.y.label.text]
                                            .concat(_(currLayers).pluck('y'))
                                            .join(', ');
                                    }
                                }
                            });

                    } else {

                        chart.traverseSpec(
                            {unit: currUnit},
                            function (unit, parentUnit) {

                                if (self.predicateIsElement(specRef, unit, parentUnit)) {
                                    unit.type = ELEMENT_TYPE[xLayer.type];
                                    unit.y = xLayer.y;
                                    self.addTransformation(unit, 'defined-only', {key: xLayer.y});
                                }

                                if (self.predicateIsCoord(specRef, unit)) {
                                    unit.y = xLayer.y;
                                    unit.guide.y.label = (unit.guide.y.label || {});
                                    unit.guide.y.label.text = xLayer.y;
                                    unit.guide.x.hide = true;

                                    if (settings.mode === 'dock') {
                                        unit.guide.showGridLines = '';
                                        unit.guide.padding.l += totalPad;
                                        unit.guide.y.label.textAnchor = 'end';
                                        unit.guide.y.label.dock = 'right';
                                        unit.guide.y.label.padding = -10;
                                        unit.guide.y.label.cssClass = 'label inline';
                                        unit.guide.y.padding += ((totalDif * (i)) + 10 * i);
                                    } else if (settings.mode === 'merge') {
                                        unit.guide.showGridLines = '';
                                        unit.guide.y.hide = true;
                                    }
                                }
                            });
                    }

                    return currUnit;
                });
            },

            // jscs:disable maximumLineLength
            containerTemplate: '<div class="graphical-report__trendlinepanel"></div>',
            template: _.template([
                '<label class="graphical-report__trendlinepanel__title graphical-report__checkbox">',
                '   <input type="checkbox"',
                '          class="graphical-report__checkbox__input i-role-show-layers"',
                '          <%= (showLayers ? "checked" : "") %>',
                '   />',
                '   <span class="graphical-report__checkbox__icon"></span>',
                '   <span class="graphical-report__checkbox__text"><%= title %></span>',
                '</label>',

                '<div>',
                '<select class="i-role-change-mode graphical-report__select graphical-report__trendlinepanel__control">',
//              '   <option <%= ((mode === "split") ? "selected" : "") %> value="split">Split</option>',
                '   <option <%= ((mode === "dock")  ? "selected" : "") %> value="dock">Dock</option>',
                '   <option <%= ((mode === "merge") ? "selected" : "") %> value="merge">Merge</option>',
                '</select>',
                '</div>',

                '<div class="graphical-report__trendlinepanel__error-message"><%= error %></div>'
            ].join('')),
            // jscs:enable maximumLineLength

            onRender: function (chart) {

                if (settings.showPanel) {
                    this._container.innerHTML = this.template({
                        title: 'Layers',
                        mode: settings.mode,
                        error: this._error,
                        showLayers: settings.showLayers
                    });
                }
            }
        };
    }

    tauCharts.api.plugins.add('layers', layers);

    return layers;
});
// jscs:enable *