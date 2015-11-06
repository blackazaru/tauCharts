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

                var spec = pluginsSDK.spec(this._chart.getSpec());

                spec.addTransformation('defined-only', function (data, props) {
                    var k = props.key;
                    return _(data)
                        .chain()
                        .filter(function (row) {
                            return ((row[k] !== null) && (typeof (row[k]) !== 'undefined'));
                        })
                        .value();
                });

                var errors = this.checkIfApplicable(spec);
                this._isApplicable = (errors.length === 0);

                if (!this._isApplicable) {
                    var log = spec.getSettings('log');
                    log('[layers plugin]: is not applicable');
                    log('[layers plugin]: ' + errors.join(' / '));
                    return;
                }

                spec.setSettings('excludeNull', false)
                    .setSettings('fitModel', null);

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

            checkIfApplicable: function (spec) {

                return spec.unit().reduce(function (errors, unit, parent) {

                    if (parent && (parent.type !== 'COORDS.RECT')) {
                        return errors.concat('Chart specification contains non-rectangular coordinates');
                    }

                    if (parent && (parent.type === 'COORDS.RECT') && (unit.type === 'COORDS.RECT')) {
                        return errors.concat('Chart is a facet');
                    }

                    if (parent && (parent.type === 'COORDS.RECT') && (unit.type !== 'COORDS.RECT')) {
                        // is Y axis a measure?
                        var yScale = spec.getScale(unit.y);
                        if (spec.getSourceDim(yScale.source, yScale.dim).type !== 'measure') {
                            return errors.concat('Y scale is not a measure');
                        }
                    }

                    return errors;

                }, []);
            },

            isLeafElement: function (unit, parent) {
                return (
                    (parent)
                    &&
                    (parent.type === 'COORDS.RECT')
                    &&
                    (unit.type !== 'COORDS.RECT')
                );
            },

            isFinalCoordNode: function (unit, parent) {
                return (
                    (unit)
                    &&
                    (unit.type === 'COORDS.RECT')
                    &&
                    (_.every(unit.units, function (subUnit) {
                        return subUnit.type !== 'COORDS.RECT';
                    }))
                );
            },

            buildLayersLayout: function (fullSpec) {

                return (fullSpec.regSource('$',
                    {
                        dims: {
                            x: {type: 'category'},
                            y: {type: 'category'}
                        },
                        data: [{x: 1, y: 1}]
                    })
                    .addScale('xLayoutScale', {type: 'ordinal', source: '$', dim: 'x'})
                    .addScale('yLayoutScale', {type: 'ordinal', source: '$', dim: 'y'})
                    .unit({
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
                        }
                    }));
            },

            findPrimaryYScale: function (spec) {
                var self = this;
                var resY = spec.unit().reduce(function (memo, unit) {
                    return memo.concat(self.isFinalCoordNode(unit) ? unit.y : []);
                }, []);

                return _.uniq(resY)[0];
            },

            onSpecReady: function (chart, specRef) {

                var self = this;

                var fullSpec = pluginsSDK.spec(specRef);

                if (!settings.showLayers || !self._isApplicable) {
                    fullSpec.unit().traverse(function (unit, parentUnit) {
                        if (self.isLeafElement(unit, parentUnit)) {
                            pluginsSDK
                                .unit(unit)
                                .addTransformation('defined-only', {key: fullSpec.getScale(unit.y).dim});
                        }
                    });
                    return;
                }

                fullSpec = settings
                    .layers
                    .reduce(function (memo, layer) {
                        return memo.addScale(
                            layer.y,
                            _.extend(
                                {type: 'linear', source: '/', dim: layer.y, autoScale: true},
                                (_.pick(layer.guide || {}, 'min', 'max', 'autoScale'))));
                    }, fullSpec);

                var primaryY = self.findPrimaryYScale(fullSpec);
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
                        var yScale = fullSpec.getScale(y);
                        yScale.min = minMax[0];
                        yScale.max = minMax[1];
                        yScale.autoScale = false;
                    });
                }

                var prevUnit = fullSpec.unit();
                var cursor;
                var totalDif = (30);
                var totalPad = (currLayers.length * totalDif) - totalDif;
                var extractLabel = function (layer) {
                    var g = layer.guide || {};
                    return (g.label || layer.y);
                };

                var currUnit = self
                    .buildLayersLayout(fullSpec)
                    .addFrame({
                        key: {x: 1, y: 1},
                        units: [
                            (cursor = pluginsSDK
                                .unit(prevUnit.clone()))
                                .reduce(function (memo, unit, parent) {

                                    if (self.isLeafElement(unit, parent)) {
                                        pluginsSDK
                                            .unit(unit)
                                            .addTransformation('defined-only', {key: fullSpec.getScale(unit.y).dim});
                                    }

                                    if (self.isFinalCoordNode(unit)) {

                                        if (settings.mode === 'dock') {
                                            unit.guide.padding.l += totalPad;
                                            unit.guide.y.label.textAnchor = 'end';
                                            unit.guide.y.label.dock = 'right';
                                            unit.guide.y.label.padding = -10;
                                            unit.guide.y.label.cssClass = 'label inline';
                                        }

                                        if (settings.mode === 'merge') {
                                            unit.guide.y.label = (unit.guide.y.label || {});
                                            unit.guide.y.label.text = [unit.guide.y.label.text]
                                                .concat(_(currLayers).map(extractLabel))
                                                .join(', ');
                                        }
                                    }
                                    return memo;
                                }, cursor)
                                .value()
                        ]
                    });

                currLayers.reduce(
                    function (specUnitObject, xLayer, ii) {

                        var i = ii + 1;

                        return specUnitObject.addFrame({
                            key: {x: 1, y: 1},
                            units: [
                                (cursor = pluginsSDK
                                    .unit(prevUnit.clone()))
                                    .reduce(function (memo, unit, parent) {

                                        if (self.isLeafElement(unit, parent)) {
                                            unit.type = ELEMENT_TYPE[xLayer.type];
                                            unit.y = xLayer.y;
                                            pluginsSDK
                                                .unit(unit)
                                                .addTransformation('defined-only', {key: xLayer.y});
                                        }

                                        if (self.isFinalCoordNode(unit)) {
                                            unit.y = xLayer.y;
                                            unit.guide.y.label = (unit.guide.y.label || {});
                                            unit.guide.y.label.text = extractLabel(xLayer);
                                            unit.guide.x.hide = true;

                                            if (settings.mode === 'dock') {
                                                unit.guide.showGridLines = '';
                                                unit.guide.padding.l += totalPad;
                                                unit.guide.y.label.textAnchor = 'end';
                                                unit.guide.y.label.dock = 'right';
                                                unit.guide.y.label.padding = -10;
                                                unit.guide.y.label.cssClass = 'label inline';
                                                unit.guide.y.padding += ((totalDif * (i)) + 10 * i);
                                            }

                                            if (settings.mode === 'merge') {
                                                unit.guide.showGridLines = '';
                                                unit.guide.y.hide = true;
                                            }
                                        }
                                        return memo;
                                    }, cursor)
                                    .value()
                            ]
                        });

                    },
                    currUnit);
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
                '   <option <%= ((mode === "dock")  ? "selected" : "") %> value="dock">Dock</option>',
                '   <option <%= ((mode === "merge") ? "selected" : "") %> value="merge">Merge</option>',
                '</select>',
                '</div>',

                '<div class="graphical-report__trendlinepanel__error-message"><%= error %></div>'
            ].join('')),
            // jscs:enable maximumLineLength

            onRender: function (chart) {

                if (this._isApplicable && settings.showPanel) {
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