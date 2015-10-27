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

    function layers2(xSettings) {

        var settings = _.defaults(
            xSettings || {},
            {
                type: 'linear',
                hideError: false,
                showPanel: true,
                showLayers: true,
                mode: 'dock'
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
                    data: []
                };

                if (settings.mode === 'dock') {
                    specRef.sources['$'].data = [
                        {
                            x: 1,
                            y: 1
                        }
                    ];
                }

                if (settings.mode === 'split') {
                    specRef.sources['$'].data = layers.map(function (item, i) {
                        return {
                            x: 1,
                            y: (i + 1)
                        };
                    });
                    specRef.sources['$'].data.push({
                        x: 1,
                        y: (layers.length + 1)
                    });
                }

                specRef.scales['xLayoutScale'] = {type: 'ordinal', source: '$', dim: 'x'};
                specRef.scales['yLayoutScale'] = {type: 'ordinal', source: '$', dim: 'y'};

                var prevUnit = specRef.unit;
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

                            var layerY = ((settings.mode === 'split') ? (i + 2) : 1);

                            return memo.concat({
                                key: {x: 1, y: layerY, i: (i + 1)},
                                source: '$',
                                pipe: [],
                                units: [layerInvoker(pluginsSDK.cloneObject(prevUnit), (i + 1), item)]
                            });
                        },
                        [
                            {
                                key: {x: 1, y: 1, i: 0},
                                source: '$',
                                pipe: [],
                                units: [layerInvoker(pluginsSDK.cloneObject(prevUnit), 0, null)]
                            }
                        ])
                };
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

                self.buildLayersLayout(specRef, settings.layers, function (currUnit, i, xLayer) {

                    var totalDif = (30);
                    var totalPad = (settings.layers.length * totalDif);

                    if (i === 0) {
                        chart.traverseSpec(
                            {unit:currUnit},
                            function (unit, parentUnit) {

                                if (!self.predicateIsElement(specRef, unit, parentUnit)) {
                                    return;
                                }

                                unit.transformation = unit.transformation || [];
                                unit.transformation.push({
                                    type: 'defined-only',
                                    args: {key: specRef.scales[unit.y].dim}
                                });

                                if (settings.mode === 'dock') {
                                    //parentUnit.guide.y.label = parentUnit.guide.y.label || {};
                                    //var ys = [parentUnit.guide.y.label.text].concat(_(settings.layers).pluck('y'));
                                    //parentUnit.guide.y.label.text = ys.join(', ');

                                    // parentUnit.guide.y.padding = parentUnit.guide.y.padding - (settings.layers.length * 25);
                                    // parentUnit.guide.y.label.padding = parentUnit.guide.y.label.padding + totalPad;
                                    parentUnit.guide.padding.l = parentUnit.guide.padding.l + totalPad;

                                    parentUnit.guide.y.label.textAnchor = 'end';
                                    parentUnit.guide.y.label.dock = 'right';
                                    parentUnit.guide.y.label.padding = -10;
                                    parentUnit.guide.y.label.cssClass = 'label inline';
                                }
                            });
                    } else {
                        chart.traverseSpec(
                            {unit: currUnit},
                            function (unit, parentUnit) {

                                if (!self.predicateIsElement(specRef, unit, parentUnit)) {
                                    return;
                                }

                                var offset = (totalDif * (i));
                                var gLines = '';
                                if (settings.mode === 'split') {
                                    offset = 0;
                                    gLines = 'xy';
                                }

                                parentUnit.y = xLayer.y;

                                // parentUnit.guide.padding.l = parentUnit.guide.padding.l + totalPad;
                                // parentUnit.guide.y.padding = parentUnit.guide.y.padding + offset;
                                // parentUnit.guide.y.padding = parentUnit.guide.y.padding + offset + 10 * i;
                                parentUnit.guide.y.label = (parentUnit.guide.y.label || {});
                                // parentUnit.guide.y.label.text = ((settings.mode === 'split') ? xLayer.y : '');
                                parentUnit.guide.y.label.text = xLayer.y;
                                parentUnit.guide.x.hide = true;
                                parentUnit.guide.showGridLines = gLines;


                                if (settings.mode === 'dock') {
                                    parentUnit.guide.padding.l = parentUnit.guide.padding.l + totalPad;
                                    parentUnit.guide.y.padding = parentUnit.guide.y.padding + offset + 10 * i;
                                    parentUnit.guide.y.label.textAnchor = 'end';
                                    parentUnit.guide.y.label.dock = 'right';
                                    parentUnit.guide.y.label.padding = -10;
                                    parentUnit.guide.y.label.cssClass = 'label inline';
                                }


                                unit.type = ELEMENT_TYPE[xLayer.type];
                                unit.y = xLayer.y;
                                unit.transformation = unit.transformation || [];
                                unit.transformation.push({
                                    type: 'defined-only',
                                    args: {key: xLayer.y}
                                });
                                unit.guide = unit.guide || {};
                            });
                    }

                    return currUnit;
                });
            },

            // jscs:disable maximumLineLength
            containerTemplate: '<div class="graphical-report__trendlinepanel"></div>',
            template: _.template([
                '<label class="graphical-report__trendlinepanel__title graphical-report__checkbox">',
                '<input type="checkbox" class="graphical-report__checkbox__input i-role-show-layers" <%= showLayers %> />',
                '<span class="graphical-report__checkbox__icon"></span>',
                '<span class="graphical-report__checkbox__text">',
                '<%= title %>',
                '</span>',
                '</label>',

                '<div>',
                '<select class="i-role-change-mode graphical-report__select graphical-report__trendlinepanel__control">',
                '   <option <%= ((mode === "join")  ? "selected" : "") %> value="join">Join</option>',
                '   <option <%= ((mode === "split") ? "selected" : "") %> value="split">Split</option>',
                '   <option <%= ((mode === "dock")  ? "selected" : "") %> value="dock">Dock</option>',
                '</select>',
                '</div>',

                '<div class="graphical-report__trendlinepanel__error-message"><%= error %></div>'
            ].join('')),
            // jscs:enable maximumLineLength

            onRender: function (chart) {

                if (this._container) {
                    this._container.innerHTML = this.template({
                        title: 'Layers',
                        mode: settings.mode,
                        error: this._error,
                        showLayers: ((settings.showLayers) ? 'checked' : '')
                    });
                }
            }
        };
    }

    tauCharts.api.plugins.add('layers2', layers2);

    return layers2;
});
// jscs:enable *