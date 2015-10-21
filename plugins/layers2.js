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
    var d3 = tauCharts.api.d3;

    function layers2(xSettings) {

        var settings = _.defaults(
            xSettings || {},
            {
                type: 'linear',
                hideError: false,
                showPanel: true,
                showTrend: true
            });

        var xLayer = settings.layers[0];

        var ELEMENT_TYPE = {
            line: 'ELEMENT.LINE',
            scatterplot: 'ELEMENT.POINT',
            bar: 'ELEMENT.INTERVAL'
        };

        return {

            init: function (chart) {

                this._chart = chart;
                this._applicableElements = [
                    'ELEMENT.POINT',
                    'ELEMENT.LINE',
                    'ELEMENT.AREA',
                    'ELEMENT.INTERVAL'
                ];

                this._isApplicable = this.checkIfApplicable(chart);

                if (settings.showPanel) {

                    this._container = chart.insertToRightSidebar(this.containerTemplate);

                    var classToAdd = 'applicable-true';
                    if (!this._isApplicable) {
                        classToAdd = 'applicable-false';
                        this._error = [
                            'Trend line can\'t be computed for categorical data.',
                            'Each axis should be either a measure or a date.'
                        ].join(' ');
                    }

                    this._container.classList.add(classToAdd);

                    if (settings.hideError) {
                        this._container
                            .classList
                            .add('hide-trendline-error');
                    }

                    this.uiChangeEventsDispatcher = function (e) {

                        var target = e.target;
                        var selector = target.classList;

                        if (selector.contains('i-role-show-trend')) {
                            settings.showTrend = target.checked;
                        }

                        if (selector.contains('i-role-change-model')) {
                            settings.type = target.value;
                        }

                        this._chart.refresh();

                    }.bind(this);

                    this._container
                        .addEventListener('change', this.uiChangeEventsDispatcher, false);
                }
            },

            checkIfApplicable: function (chart) {

                var self = this;
                var specRef = chart.getConfig();
                var isApplicable = false;

                chart.traverseSpec(specRef, function (unit, parentUnit) {
                    if (self.predicateIsApplicable(specRef, unit, parentUnit)) {
                        isApplicable = true;
                    }
                });

                return isApplicable;
            },

            predicateIsApplicable: function (specRef, unit, parentUnit) {

                if (parentUnit && parentUnit.type !== 'COORDS.RECT') {
                    return false;
                }

                if (this._applicableElements.indexOf(unit.type) === -1) {
                    return false;
                }

                var xScale = specRef.scales[unit.x];
                var yScale = specRef.scales[unit.y];

                return !(xScale.type === 'ordinal' || yScale.type === 'ordinal');
            },

            onSpecReady: function (chart, specRef) {

                var self = this;

                if (!settings.showTrend) {
                    return;
                }

                specRef.scales['r-position'] = {type: 'linear', source: '/', dim: xLayer.y};

                specRef.sources['$'] = {
                    dims: {
                        x: {type: 'category'},
                        y: {type: 'category'}
                    },
                    data: [
                        {x: 1, y: 1}
                    ]
                };
                specRef.scales['xScale'] = {type: 'ordinal', source: '$', dim: 'x'};
                specRef.scales['yScale'] = {type: 'ordinal', source: '$', dim: 'y'};

                var oldUnit = specRef.unit;
                var oldClone = JSON.parse(JSON.stringify(oldUnit));
                oldClone.y = 'r-position';
                oldClone.guide.y.padding = oldUnit.guide.y.padding + 30;
                oldClone.guide.x.hide = true;
                oldClone.guide.showGridLines = '';

                specRef.unit = {
                    type: 'COORDS.RECT',
                    x: 'xScale',
                    y: 'yScale',
                    expression: {
                        source: '$',
                        inherit: false,
                        operator: false
                    },
                    guide: {
                        showGridLines: ''
                    },
                    frames: [
                        {
                            key: {x: 1, y: 1, i: 0},
                            source: '$',
                            pipe: [],
                            units: [oldUnit]
                        },
                        {
                            key: {x: 1, y: 1, i: 1},
                            source: '$',
                            pipe: [],
                            units: [oldClone]
                        }
                    ]
                };

                specRef.transformations = specRef.transformations || {};
                specRef.transformations['slice-by'] = function (data, props) {
                    var k = props.key;
                    var v = props.val;
                    return _(data)
                        .chain()
                        .filter(function (row) {
                            return (row[k] === v);
                        })
                        .value();
                };

                chart.traverseSpec(
                    {unit:oldClone},
                    function (unit, parentUnit) {

                        if (!self.predicateIsApplicable(specRef, unit, parentUnit)) {
                            return;
                        }

                        var trend = JSON.parse(JSON.stringify(unit));

                        trend.type = ELEMENT_TYPE[xLayer.type];
                        trend.y = 'r-position';
                        trend.transformation = trend.transformation || [];
                        trend.transformation.push({
                            type: 'slice-by',
                            args: {key: xLayer.by, val: xLayer.is}
                        });
                        trend.guide = trend.guide || {};
                        // trend.guide.widthCssClass = 'graphical-report__line-width-1';

                        parentUnit.units = [trend];
                    });

                chart.traverseSpec(
                    {unit:oldUnit},
                    function (unit, parentUnit) {

                        if (!self.predicateIsApplicable(specRef, unit, parentUnit)) {
                            return;
                        }

                        unit.transformation = unit.transformation || [];
                        unit.transformation.push({
                            type: 'slice-by',
                            args: {key: xLayer.by, val: null}
                        });
                    });
            },

            // jscs:disable maximumLineLength
            containerTemplate: '<div class="graphical-report__trendlinepanel"></div>',
            template: _.template([
                '<label class="graphical-report__trendlinepanel__title graphical-report__checkbox">',
                '<input type="checkbox" class="graphical-report__checkbox__input i-role-show-trend" <%= showTrend %> />',
                '<span class="graphical-report__checkbox__icon"></span>',
                '<span class="graphical-report__checkbox__text">',
                '<%= title %>',
                '</span>',
                '</label>',
                '<div class="graphical-report__trendlinepanel__error-message"><%= error %></div>'
            ].join('')),
            // jscs:enable maximumLineLength

            onRender: function (chart) {

                if (this._container) {
                    this._container.innerHTML = this.template({
                        title: 'Layers',
                        error: this._error,
                        showTrend: (settings.showTrend && this._isApplicable) ? 'checked' : ''
                    });
                }
            }
        };
    }

    tauCharts.api.plugins.add('layers2', layers2);

    return layers2;
});
// jscs:enable *