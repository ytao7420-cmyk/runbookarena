from test_contract import Tests
import json
x=Tests();x.setUp();x.act('RESTORE');x.success();print(json.dumps(x.record(),sort_keys=True))
