
const assert = require('chai').assert;
const ADOUtilsModule = require("../ADOUtilities");
const basicADOUtility = ADOUtilsModule({});
describe('ADOUtilites', function() {
  describe('#buildDateStringForAnalytics()', function() {
    it('should change year on newyears', function() {
      assert.equal(basicADOUtility.buildDateStringForAnalytics('2018-12-31T00:00:00-04:00',1),'2019-01-01T00:00:00-04:00');
    });

        let  tests  = [
            {args:['2019-06-27T00:00:00-04:00',1],expected:'2019-06-28T00:00:00-04:00'},
            {args:['2019-06-30T00:00:00-04:00',1],expected:'2019-07-01T00:00:00-04:00'},
            {args:['2018-12-31T00:00:00-04:00',366],expected:'2020-01-01T00:00:00-04:00'},
        ];

      tests.forEach(function(test) {
          it('correctly adds '+ test.args[1] + ' days to ' + test.args[0], function() {
              var res = basicADOUtility.buildDateStringForAnalytics.apply(null, test.args);
              assert.equal(res, test.expected);
          });
      });
    });

    describe('#buildDateStringForADO()', function() {
      it('should change year on newyears', function() {
        assert.equal(basicADOUtility.buildDateStringForADO('2018-12-31T00:00:00-04:00',1),'20190101');
      });
  
          let  tests  = [
              {args:['2019-06-27T00:00:00-04:00',1],expected:'20190628'},
              {args:['2019-06-30T00:00:00-04:00',1],expected:'20190701'},
              {args:['2018-12-31T00:00:00-04:00',366],expected:'20200101'},
              {args:['2018-12-31',366],expected:'20200101'},
          ];
  
        tests.forEach(function(test) {
            it('correctly adds '+ test.args[1] + ' days to ' + test.args[0], function() {
                var res = basicADOUtility.buildDateStringForADO.apply(null, test.args);
                assert.equal(res, test.expected);
            });
        });
      });
});
