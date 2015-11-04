define(function (require) {
    var expect = require('chai').expect;
    var schemes = require('schemes');
    var tauChart = require('src/tau.charts');

    describe('Plugins SDK', function () {

        var sdk;
        beforeEach(function () {
            sdk = tauChart.api.pluginsSDK;
        });

        it('should support [addTransformation] method', function () {
            var specRef = {};
            sdk.spec(specRef).addTransformation('test', ((data) => (data)));

            expect(specRef.hasOwnProperty('transformations')).to.equal(true);
            expect(specRef.transformations.hasOwnProperty('test')).to.equal(true);
            expect(specRef.transformations.test(1)).to.equal(1);
        });

        it('should support [getSettings] method', function () {
            var specRef = {
                settings: {
                    testSettings: 'blabla'
                }
            };
            expect(sdk.spec(specRef).getSettings('testSettings')).to.equal('blabla');
            expect(sdk.spec(specRef).getSettings('test2')).to.equal(undefined);
        });

        it('should support [setSettings] method', function () {
            var specRef = {
                settings: {
                    testSettings: 'blabla'
                }
            };
            sdk.spec(specRef)
                .setSettings('testSettings', 'silent')
                .setSettings('test2', 'test-value');

            expect(specRef.settings.testSettings).to.equal('silent');
            expect(specRef.settings.test2).to.equal('test-value');
        });

        it('should support [traverse] method', function () {
            var specRef = {
                unit: {
                    type: 'A',
                    units: [
                        {
                            type: 'A0'
                        }
                        ,
                        {
                            type: 'A1',
                            units: [
                                {
                                    type: 'A11'
                                }
                            ]
                        }
                    ]
                }
            };
            var r = [];
            sdk.spec(specRef).traverse(function (unit, parent) {
                var p = parent || {type:'nil'};
                r.push('(' + p.type + '>' + unit.type + ')');
            });
            expect(r.join('-')).to.equal('(nil>A)-(A>A0)-(A>A1)-(A1>A11)');
        });

        it('should support [reduce] method', function () {
            var specRef = {
                unit: {
                    type: 'A',
                    units: [
                        {
                            type: 'A0'
                        }
                        ,
                        {
                            type: 'A1',
                            units: [
                                {
                                    type: 'A11'
                                }
                            ]
                        }
                    ]
                }
            };

            var k = sdk.spec(specRef).reduce(function (memo, unit, parent) {
                memo += 1;
                return memo;
            }, 0);
            expect(k).to.equal(4);

            var m = sdk.spec(specRef).reduce(function (memo, unit, parent) {
                var p = parent || {type:'nil'};
                var token = ('(' + p.type + '>' + unit.type + ')');
                return memo.concat([token]);
            }, []);
            expect(m.join('-')).to.equal('(nil>A)-(A>A0)-(A>A1)-(A1>A11)');
        });

        it('should support [getScale] method', function () {
            var specRef = {
                scales: {
                    'a': {dim:'a', source:'/'}
                }
            };

            expect(sdk.spec(specRef).getScale('a')).to.equal(specRef.scales.a);
        });

        it('should support [addScale] method', function () {
            var specRef = {
                scales: {
                    'a': {dim:'a', source:'/'}
                }
            };

            var spec = sdk.spec(specRef);
            spec.addScale('b', {dim:'b', source:'/'});
            expect(spec.getScale('b')).to.equal(specRef.scales.b);
        });

        it('should support [getSourceData] method', function () {
            var specRef = {
                sources: {
                    'test': {
                        dims: {a: {type:'measure'}},
                        data: [
                            {a:1}
                        ]
                    }
                }
            };

            expect(sdk.spec(specRef).getSourceData('test'))
                .to
                .equal(specRef.sources.test.data);

            expect(sdk.spec(specRef).getSourceData('unknown'))
                .to
                .deep
                .equal([]);
        });

        it('should support [getSourceDim] method', function () {
            var specRef = {
                sources: {
                    'test': {
                        dims: {a: {type:'measure'}},
                        data: [
                            {a:1}
                        ]
                    }
                }
            };

            expect(sdk.spec(specRef).getSourceDim('test', 'a'))
                .to
                .equal(specRef.sources.test.dims.a);

            expect(sdk.spec(specRef).getSourceDim('test', 'b'))
                .to
                .deep
                .equal({});

            expect(sdk.spec(specRef).getSourceDim('unknown', 'a'))
                .to
                .deep
                .equal({});
        });

        it('should support [unit.addTransformation] method', function () {
            var unitRef1 = {
                type: 'COORDS.RECT'
            };

            sdk.unit(unitRef1).addTransformation('test', 'a');

            expect(unitRef1.transformation.length).to.equal(1);
            expect(unitRef1.transformation[0]).to.deep.equal({
                type: 'test',
                args: 'a'
            });

            var unitRef2 = {
                type: 'COORDS.RECT',
                transformation: [
                    {type: 'noop', args: null}
                ]
            };

            sdk.unit(unitRef2).addTransformation('test', 'a');

            expect(unitRef2.transformation.length).to.equal(2);
            expect(unitRef2.transformation[0]).to.deep.equal({
                type: 'noop',
                args: null
            });
            expect(unitRef2.transformation[1]).to.deep.equal({
                type: 'test',
                args: 'a'
            });
        });

        it('should support [unit.value] method', function () {
            var unitRef = {type: 'COORDS.RECT'};
            var u = sdk.unit(unitRef);
            unitRef.test = 2;
            expect(u.value()).to.equal(unitRef);
        });

        it('should support [unit.isCoord] method', function () {
            expect(sdk.unit({type: 'COORDS.PARALLEL'}).isCoordinates()).to.equal(true);
            expect(sdk.unit({type: 'COORDS.RECT'}).isCoordinates()).to.equal(true);
            expect(sdk.unit({type: 'COORDS.RECT'}).isElementOf('RECT')).to.equal(false);

            expect(sdk.unit({type: 'ELEMENT.LINE'}).isCoordinates()).to.equal(false);
            expect(sdk.unit({type: 'ELEMENT.LINE'}).isElementOf('RECT')).to.equal(true);

            expect(sdk.unit({type: 'PARALLEL/ELEMENT.LINE'}).isElementOf('RECT')).to.equal(false);
            expect(sdk.unit({type: 'PARALLEL/ELEMENT.LINE'}).isElementOf('parallel')).to.equal(true);
        });
    });
});