define(function (require) {
    var expect = require('chai').expect;
    var schemes = require('schemes');
    var tauChart = require('src/tau.charts');

    describe('Plugins SDK', function () {

        var sdk;
        beforeEach(function () {
            sdk = tauChart.api.pluginsSDK;
        });

        it('should add transformation', function () {
            var specRef = {};
            sdk.spec(specRef).addTransformation('test', ((data) => (data)));

            expect(specRef.hasOwnProperty('transformations')).to.equal(true);
            expect(specRef.transformations.hasOwnProperty('test')).to.equal(true);
            expect(specRef.transformations.test(1)).to.equal(1);
        });

        it('should get settings', function () {
            var specRef = {
                settings: {
                    testSettings: 'blabla'
                }
            };
            expect(sdk.spec(specRef).getSettings('testSettings')).to.equal('blabla');
            expect(sdk.spec(specRef).getSettings('test2')).to.equal(undefined);
        });

        it('should set settings', function () {
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

        it('should traverse spec', function () {
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
        });
    });
});