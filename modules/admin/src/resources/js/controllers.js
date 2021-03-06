(function() {
	"use strict";
	
	zaa.config(function($stateProvider, resolverProvider) {
		$stateProvider
		.state("default.route.detail", {
			url: "/:id",
			parent: 'default.route',
			template: '<ui-view/>',
			controller:function($scope, $stateParams) {
				
				$scope.crud = $scope.$parent;
				
				$scope.init = function() {
					if (!$scope.crud.config.inline) {
						if ($scope.crud.data.updateId != $stateParams.id) {
							$scope.crud.toggleUpdate($stateParams.id);
						}
					}
				}
				
				$scope.init();
			}
		})
	});
	
	zaa.controller("DefaultDashboardObjectController", function($scope, $http, $sce) {
		
		$scope.data;
		
		$scope.loadData = function(dataApiUrl) {
			$http.get(dataApiUrl).then(function(success) {
				$scope.data = success.data;
			});
		};
	});
	
	/**
	 * Base Crud Controller
	 * 
	 * Assigned config variables from the php view assigned from child to parent:
	 * 
	 * + bool $config.inline Determines whether this crud is in inline mode orno
	 */
	zaa.controller("CrudController", function($scope, $filter, $http, $sce, $state, $timeout, $injector, AdminLangService, LuyaLoading, AdminToastService, CrudTabService) {

		/**
		 * initializer called by dom render in active window due to controller extends ability.
		 */
		$scope.init = function () {
			$scope.loadList();
		};
		
		LuyaLoading.start();
		
		$scope.toast = AdminToastService;

		$scope.AdminLangService = AdminLangService;
		
		$scope.tabService = CrudTabService;
		
		/**
		 * 0 = list
		 * 1 = add
		 * 2 = edit
		 */
		$scope.crudSwitchType = 0;
		
		$scope.switchToTab = function(tab) {
			angular.forEach($scope.tabService.tabs, function(item) {
				item.active = false;
			});
			
			tab.active = true;
			
			$scope.switchTo(4);
		};
		
		$scope.closeTab = function(tab, index) {
			$scope.tabService.remove(index, $scope);
		};
		
		$scope.switchTo = function(type, reset) {
			
			if ($scope.config.relationCall) {
				$scope.crudSwitchType = type;
				return;
			}
			
			if (reset) {
				$scope.resetData();
			}
			
			if (type == 0) {
				$http.get($scope.config.apiEndpoint + '/unlock');
			}
			
			if (type == 0 || type == 1) {
				if (!$scope.config.inline) {
					$state.go('default.route');
				}
			}
			$scope.crudSwitchType = type;
			
			if (type !== 4) {
				angular.forEach($scope.tabService.tabs, function(item) {
					item.active = false;
				});
			}
		};
		
		$scope.changeGroupByField = function() {
			if ($scope.config.groupByField == 0) {
				$scope.config.groupBy = 0;
			} else {
				$scope.config.groupBy = 1;
			}
		}
		
		$scope.parentSelectInline = function(item) {
			$scope.$parent.$parent.$parent.setModelValue($scope.getRowPrimaryValue(item));
		};
		
		$scope.relationItems = [];
		
		/*
		$scope.loadRelation = function(id, api, where) {
			$scope.relationItems.push({'active': true, 'api': api, 'id': id, 'where': where});
			$scope.switchTo(4);
		}
		*/
		
		// ng-change event triggers this method
		// this method is also used withing after save/update events in order to retrieve current selecter filter data.
		$scope.realoadCrudList = function(pageId) {
			LuyaLoading.start();
			if ($scope.config.filter == 0) {
				 $scope.loadList(pageId);
			} else {
				var url = $scope.config.apiEndpoint + '/filter?filterName=' + $scope.config.filter + '&' + $scope.config.apiListQueryString;
				if (pageId) {
					url = url + '&page=' + pageId;
				}
				if ($scope.config.orderBy) {
					url = url + '&sort=' + $scope.config.orderBy.replace("+", "");
				}
				$http.get(url).then(function(response) {
					$scope.setPagination(
						response.headers('X-Pagination-Current-Page'),
						response.headers('X-Pagination-Page-Count'),
						response.headers('X-Pagination-Per-Page'),
						response.headers('X-Pagination-Total-Count')
					);
					LuyaLoading.stop();
					$scope.data.list = response.data;
					$scope.data.listArray = response.data;
					$scope.reApplyOrder();
				});
			}
		};
		
		$scope.$watch('config.searchQuery', function(n, o) {
			
			if (n == o) {
				return;
			}
			
			var blockRequest = false;
			
			if ($scope.pager) {
				if (n.length == 0) {
					$timeout.cancel($scope.searchPromise);
					$scope.data.listArray = $scope.data.list;
					$scope.config.pagerHiddenByAjaxSearch = false;
				} else {
					$timeout.cancel($scope.searchPromise);
					
					if (blockRequest) {
						return;
					}
					
					$scope.searchPromise = $timeout(function() {
						blockRequest = true;
						$http.post($scope.config.apiEndpoint + '/full-response?' + $scope.config.apiListQueryString, {query: n}).then(function(response) {
							$scope.config.pagerHiddenByAjaxSearch = true;
							blockRequest = false;
							$scope.config.fullSearchContainer = response.data;
							$scope.data.listArray = $filter('filter')(response.data, n);
						});
					}, 500)
				}
			} else {
				$scope.config.pagerHiddenByAjaxSearch = false;
				$scope.data.listArray = $filter('filter')($scope.data.list, n);
			}
		});
		
		/* export */
		
		$scope.exportLoading = false;
		
		$scope.exportResponse = false;
		
		$scope.exportDownloadButton = false;
		
		$scope.exportData = function() {
			$scope.exportLoading = true;
			$http.get($scope.config.apiEndpoint + '/export').then(function(response) {
				$scope.exportLoading = false;
				$scope.exportResponse = response.data;
				$scope.exportDownloadButton = true;
			});
		};
		
		$scope.exportDownload = function() {
			$scope.exportDownloadButton = false;
			window.open($scope.exportResponse.url);
			return false;
		};
		
		$scope.applySaveCallback = function() {
			if ($scope.config.saveCallback) {
				$injector.invoke($scope.config.saveCallback, this);
			}
		};
		
		$scope.showCrudList = true;
		
		$scope.isOrderBy = function(field) {
			if (field == $scope.config.orderBy) {
				return true;
			}
			
			return false;
		};
		
		$scope.changeOrder = function(field, sort) {
			$scope.config.orderBy = sort + field;
			
			$http.post('admin/api-admin-common/ngrest-order', {'apiEndpoint' : $scope.config.apiEndpoint, sort: sort, field: field}, { ignoreLoadingBar: true });
			
			if ($scope.pager && !$scope.config.pagerHiddenByAjaxSearch) {
				$scope.realoadCrudList(1);
			} else {
				$scope.data.listArray = $filter('orderBy')($scope.data.listArray, sort + field);
			}
		};
		
		$scope.reApplyOrder = function() {
			$scope.data.listArray = $filter('orderBy')($scope.data.listArray, $scope.config.orderBy);
		};
		
		$scope.activeWindowReload = function() {
			$scope.getActiveWindow($scope.data.aw.hash, $scope.data.aw.itemId);
		}
		
		$scope.getActiveWindow = function (activeWindowId, id, $event) {
			$http.post($scope.config.activeWindowRenderUrl, $.param({ itemId : id, activeWindowHash : activeWindowId , ngrestConfigHash : $scope.config.ngrestConfigHash }), {
				headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
			})
			.then(function(response) {
				$scope.openActiveWindow();
				$scope.data.aw.itemId = id;
				$scope.data.aw.configCallbackUrl = $scope.config.activeWindowCallbackUrl;
				$scope.data.aw.configHash = $scope.config.ngrestConfigHash;
				$scope.data.aw.hash = activeWindowId;
				$scope.data.aw.content = $sce.trustAsHtml(response.data.content);
				$scope.data.aw.title = response.data.alias;
				$scope.$broadcast('awloaded', {id: activeWindowId});
			})
		};
	
		$scope.getActiveWindowCallbackUrl = function(callback) {
			return $scope.data.aw.configCallbackUrl + '?activeWindowCallback=' + callback + '&ngrestConfigHash=' + $scope.data.aw.configHash + '&activeWindowHash=' + $scope.data.aw.hash;
		};
		
		/**
		 * new returns a promise promise.hten(function(answer) {
		 * 
		 * }, function(error) {
		 * 
		 * }, function(progress) {
		 * 
		 * });
		 * 
		 * instead of return variable
		 */
		$scope.sendActiveWindowCallback = function(callback, data) {
			var data = data || {};
			return $http.post($scope.getActiveWindowCallbackUrl(callback), $.param(data), {
				headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'}
			});
		};
		
		$scope.deleteItem = function(id, $event) {
			AdminToastService.confirm(i18n['js_ngrest_rm_page'], 'Entfernen', function($timeout, $toast) {
				$http.delete($scope.config.apiEndpoint + '/'+id).then(function(response) {
					$scope.loadList();
					$toast.close();
					AdminToastService.success(i18n['js_ngrest_rm_confirm'], 2000);
				}, function(data) {
					$scope.printErrors(data);
				});
			});
		};
		
		$scope.toggleUpdate = function(id) {
			$scope.resetData();
			$http.get($scope.config.apiEndpoint + '/'+id+'?' + $scope.config.apiUpdateQueryString).then(function(response) {
				var data = response.data;
				$scope.data.update = data;
				
				if ($scope.config.relationCall) {
					
					$scope.crudSwitchType = 2;
				} else {
					$scope.switchTo(2);
				}
				if (!$scope.config.inline) {
					$state.go('default.route.detail', {id : id});
				}
				$scope.data.updateId = id;
			}, function(data) {
				AdminToastService.error(i18n['js_ngrest_error'], 2000);
			});
		};
		
		$scope.closeUpdate = function () {
			$scope.switchTo(0, true);
	    };
		
		$scope.closeCreate = function() {
			$scope.switchTo(0, true);
		};
		
		$scope.activeWindowModal = true;
		
		$scope.openActiveWindow = function() {
			$scope.activeWindowModal = false;
		};
		
		$scope.closeActiveWindow = function() {
			$scope.activeWindowModal = true;
		};
		
		$scope.highlightId = 0;
		
		$scope.isHighlighted = function(itemId) {
			if (itemId[$scope.config.pk] == $scope.highlightId) {
				return true;
			}
			
			return false;
		};
		
		$scope.printErrors = function(data) {
			angular.forEach(data, function(value, key) {
				AdminToastService.error(value.message, 4500);
			});
		};
		
		$scope.submitUpdate = function () {
			$http.put($scope.config.apiEndpoint + '/' + $scope.data.updateId, angular.toJson($scope.data.update, true)).then(function(response) {
				var data = response.data;
				if ($scope.pager) {
					$scope.realoadCrudList($scope.pager.currentPage);
				} else {
					$scope.realoadCrudList();
				}
				
				$scope.applySaveCallback();
				AdminToastService.success(i18n['js_ngrest_rm_update'], 2000);
				$scope.switchTo(0, true);
				$scope.highlightItemId($scope.data.updateId);
			}, function(response) {
				$scope.printErrors(response.data);
			});
		};
		
		$scope.highlightItemId = function(id) {
			$scope.highlightId = id;
			$timeout(function() {
				$scope.highlightId = 0;
			}, 3000);
		}
		
		$scope.submitCreate = function() {
			
			if ($scope.config.relationCall) {
				//$scope.data.create[$scope.relationCall.field] = parseInt($scope.relationCall.id);
			}
			
			$http.post($scope.config.apiEndpoint, angular.toJson($scope.data.create, true)).then(function(response) {
				$scope.realoadCrudList();
				$scope.applySaveCallback();
				AdminToastService.success(i18n['js_ngrest_rm_success'], 2000);
				$scope.switchTo(0, true);
			}, function(data) {
				$scope.printErrors(data.data);
			});
		};
		
		$scope.blockFilterSeriveReload = false;
		
		$scope.evalSettings = function(settings) {
			if (settings.hasOwnProperty('order')) {
				$scope.config.orderBy = settings['order'];
			}
			
			if (!$scope.blockFilterSeriveReload) {
				if (settings.hasOwnProperty('filterName')) {
					$scope.config.filter = settings['filterName'];
				}
			}
		};
		
		$scope.$watch('config.filter', function(n, o) {
			if (n != o && n != undefined) {
				$scope.blockFilterSeriveReload = true;
				$http.post('admin/api-admin-common/ngrest-filter', {'apiEndpoint' : $scope.config.apiEndpoint, 'filterName': $scope.config.filter}, { ignoreLoadingBar: true });
				$scope.realoadCrudList();
			}
		})
		
		/**
		 * This method is triggerd by the crudLoader directive to reload service data.
		 */
		$scope.loadService = function() {
			$http.get($scope.config.apiEndpoint + '/services').then(function(serviceResponse) {
				$scope.service = serviceResponse.data.service;
			});
		};
		
		$scope.loadList = function(pageId) {
			LuyaLoading.start();
			$http.get($scope.config.apiEndpoint + '/services').then(function(response) {
				var serviceResponse = response.data;
				$scope.service = serviceResponse.service;
				$scope.evalSettings(serviceResponse._settings);
				if ($scope.config.relationCall) {
					var url = $scope.config.apiEndpoint + '/relation-call/?' + $scope.config.apiListQueryString;
					url = url + '&arrayIndex=' + $scope.config.relationCall.arrayIndex + '&id=' + $scope.config.relationCall.id + '&modelClass=' + $scope.config.relationCall.modelClass;
				} else {
					var url = $scope.config.apiEndpoint + '/?' + $scope.config.apiListQueryString;
				}
				
				if (pageId !== undefined) {
					url = url + '&page=' + pageId;
				}
				if ($scope.config.orderBy) {
					url = url + '&sort=' + $scope.config.orderBy.replace("+", "");
				}
				$http.get(url).then(function(response) {
					$scope.setPagination(
						response.headers('X-Pagination-Current-Page'),
						response.headers('X-Pagination-Page-Count'),
						response.headers('X-Pagination-Per-Page'),
						response.headers('X-Pagination-Total-Count')
					);

					// return data
					LuyaLoading.stop();
					$scope.data.list = response.data;
					$scope.data.listArray = response.data;
					$scope.reApplyOrder();
				});
			});
		};
		
		$scope.service = false;
		
		$scope.resetData = function() {
			$scope.data.create = angular.copy({});
			$scope.data.update = angular.copy({});
		}
		
		$scope.pagerPrevClick = function() {
			if ($scope.pager.currentPage != 1) {
				$scope.realoadCrudList(parseInt($scope.pager.currentPage)-1);
			}
		};
		
		$scope.pagerNextClick = function() {
			if ($scope.pager.currentPage != $scope.pager.pageCount) {
				$scope.realoadCrudList(parseInt($scope.pager.currentPage)+1);
			}
		};
		
		$scope.pager = false;
		
		$scope.setPagination = function(currentPage, pageCount, perPage, totalItems) {
			if (currentPage != null && pageCount != null && perPage != null && totalItems != null) {
				
				var i = 1;
				var urls = [];
				for (i = 1; i <= pageCount; i++) {
					urls.push(i);
				}
				
				$scope.pager = {
					'currentPage': currentPage,
					'pageCount': pageCount,
					'perPage': perPage,
					'totalItems': totalItems,
					'pages': urls,
				};
			} else {
				$scope.pager = false;
			}
		};
		
		$scope.getRowPrimaryValue = function(row) {
			return row[$scope.config.pk];
		};
		
		$scope.toggleStatus = function(row, fieldName, fieldLabel, bindValue) {
			var invertValue = !bindValue;
			var invert = invertValue ? 1 : 0;
			var rowId = row[$scope.config.pk];
			var json = {};
			json[fieldName] = invert;
			$http.put($scope.config.apiEndpoint + '/' + rowId +'?ngrestCallType=update&fields='+fieldName, angular.toJson(json, true)).then(function(response) {
				row[fieldName] = invert;
				$scope.highlightItemId(rowId);
				AdminToastService.success(i18nParam('js_ngrest_toggler_success', {field: fieldLabel}), 1500);
			}, function(data) {
				$scope.printErrors(data);
			});
		};
		
		$scope.sortableUp = function(index, row, fieldName) {
			var switchWith = $scope.data.listArray[index-1];
			$scope.data.listArray[index-1] = row;
			$scope.data.listArray[index] = switchWith;
			$scope.updateSortableIndexPositions(fieldName);
		};
		
		$scope.sortableDown = function(index, row, fieldName) {
			var switchWith = $scope.data.listArray[index+1];
			$scope.data.listArray[index+1] = row;
			$scope.data.listArray[index] = switchWith;
			$scope.updateSortableIndexPositions(fieldName);
		};
		
		$scope.updateSortableIndexPositions = function(fieldName) {
			angular.forEach($scope.data.listArray, function(value, key) {
				var json = {};
				json[fieldName] = key;
				var rowId = value[$scope.config.pk];
				$http.put($scope.config.apiEndpoint + '/' + rowId +'?ngrestCallType=update&fields='+fieldName, angular.toJson(json, true), {
					  ignoreLoadingBar: true
				});
			});
		}
		
		$scope.data = {
			create : {},
			update : {},
			aw : {},
			list : {},
			updateId : 0
		};
	});
	
// activeWindowController.js
	
	zaa.controller("ActiveWindowTagController", function($scope, $http, AdminToastService) {

		$scope.crud = $scope.$parent; // {{ data.aw.itemId }}
		
		$scope.tags = [];
		
		$scope.relation = {};
		
		$scope.newTagName = null;
		
		$scope.loadTags = function() {
			$http.get($scope.crud.getActiveWindowCallbackUrl('LoadTags')).then(function(transport) {
				$scope.tags = transport.data;
			});
		};
		
		$scope.loadRelations = function() {
			$http.get($scope.crud.getActiveWindowCallbackUrl('LoadRelations')).then(function(transport) {
				$scope.relation = {};
				transport.data.forEach(function(value, key) {
					$scope.relation[value.tag_id] = 1;
				});
			});
		};
		
		$scope.saveTag = function() {
			var tagName = $scope.newTagName;

			if (tagName !== "") {
				$scope.crud.sendActiveWindowCallback('SaveTag', {'tagName': tagName}).then(function(response) {
					if (response.data) {
						$scope.tags.push({id: response.data, name: tagName});
						AdminToastService.success(tagName + ' wurde gespeichert.', 2000);
					} else {
						AdminToastService.error(tagName + ' ' + i18n['js_tag_exists'], 2000);
					}
					$scope.newTagName = null;
				});
			}
		};
		
		$scope.saveRelation = function(tag, value) {
			$scope.crud.sendActiveWindowCallback('SaveRelation', {'tagId': tag.id, 'value': value}).then(function(response) {

				$scope.relation[tag.id] = response.data;

				AdminToastService.success(i18n['js_tag_success'], 2000);
			});
		};
		
		$scope.$watch(function() { return $scope.data.aw.itemId }, function(n, o) {
			$scope.loadRelations();
		});
		
		$scope.loadTags();
		
	});
	
	/**
	 * ActiveWindow GalleryController
	 * 
	 * Ability to upload images, removed images from index, add new images via selecting from
	 * filemanager.
	 * 
	 * Changes content when parent crud controller changes value for active aw.itemId.
	 */
	zaa.controller("ActiveWindowGalleryController", function($scope, $http) {
		
		$scope.crud = $scope.$parent; // {{ data.aw.itemId }}
		
		$scope.files = {};
		
		$scope.isEmptyObject = function(files) {
			return angular.equals({}, files);
		};
		
		$scope.select = function(id) {
			if (!(id in $scope.files)) {
				$scope.crud.sendActiveWindowCallback('AddImageToIndex', {'fileId' : id }).then(function(response) {
					var data = response.data;
					$scope.files[data.fileId] = data;
				});
			}
		};
		
		$scope.loadImages = function() {
			$http.get($scope.crud.getActiveWindowCallbackUrl('loadAllImages')).then(function(response) {
				$scope.files = {}
				response.data.forEach(function(value, key) {
					$scope.files[value.fileId] = value;
				});
			})
		};
		
		$scope.remove = function(file) {
			$scope.crud.sendActiveWindowCallback('RemoveFromIndex', {'imageId' : file.id }).then(function(response) {
				delete $scope.files[file.fileId];
			});
		};
		
		$scope.$watch(function() { return $scope.data.aw.itemId }, function(n, o) {
			$scope.loadImages();
		});
		
	});
	
	zaa.controller("ActiveWindowGroupAuth", function($scope, $http, CacheReloadService) {
		
		$scope.crud = $scope.$parent; // {{ data.aw.itemId }}
		
		$scope.reload = function() {
			CacheReloadService.reload();
		};
		
		$scope.rights = [];
		
		$scope.auths = [];
		
		$scope.save = function(data) {
			$scope.crud.sendActiveWindowCallback('saveRights', {'data' : data }).then(function(response) {
				$scope.getRights();
				$scope.reload();
			});
		};
		
		$scope.toggleAll = function() {
			angular.forEach($scope.auths,function(value, key) {
				$scope.rights[value.id] = {base: 1, create: 1, update: 1, 'delete': 1 };
			})
		};
		
		$scope.untoggleAll = function() {
			angular.forEach($scope.auths,function(value, key) {
				$scope.rights[value.id] = {base: 0, create: 0, update: 0, 'delete': 0 };
			})
		};
		
		$scope.getRights = function() {
			$http.get($scope.crud.getActiveWindowCallbackUrl('getRights')).then(function(response) {
				$scope.rights = response.data.rights;
				$scope.auths = response.data.auths;
			})
		};
		
		$scope.$on('awloaded', function(e, d) {
			$scope.getRights();
		});
		
		$scope.$watch(function() { return $scope.data.aw.itemId }, function(n, o) {
			$scope.getRights();
		});
	});
	
// DefaultController.js.
	
	zaa.controller("DefaultController", function ($scope, $http, $state, $stateParams, CrudTabService) {
		
		$scope.moduleId = $state.params.moduleId;
		
		$scope.loadDashboard = function() {
			$scope.currentItem = null;
			return $state.go('default', { 'moduleId' : $scope.moduleId});
		}
		
		$scope.items = [];
		
		$scope.itemRoutes = [];
		
		$scope.currentItem = null;
		
		$scope.dashboard = [];
		
		$scope.itemAdd = function (name, items) {
			
			$scope.items.push({name : name, items : items});
			
			for(var i in items) {
				var data = items[i];
				$scope.itemRoutes[data.route] = {
					alias : data.alias, icon : data.icon
				}
			}
		};
		
		$scope.getDashboard = function(nodeId) {
			$http.get('admin/api-admin-menu/dashboard', { params : { 'nodeId' : nodeId }} ).then(function(data) {
				$scope.dashboard = data.data;
			});
		};
		
		$scope.init = function() {
			$scope.get();
			$scope.getDashboard($scope.moduleId);
		};
		
		$scope.resolveCurrentItem = function() {
			if (!$scope.currentItem) {
				if ($state.current.name == 'default.route' || $state.current.name == 'default.route.detail') {
					var params = [$stateParams.moduleRouteId, $stateParams.controllerId, $stateParams.actionId];
					var route = params.join("/");
					if ($scope.itemRoutes.indexOf(route)) {
						$scope.currentItem = $scope.itemRoutes[route];
						$scope.currentItem.route = route;
					}
				}
			}
		};
		
		$scope.click = function(item) {
			$scope.currentItem = item;
			
			var id = item.route;
			var res = id.split("/");
			CrudTabService.clear();
			
			$state.go('default.route', { moduleRouteId : res[0], controllerId : res[1], actionId : res[2]});
		};
		
		$scope.get = function () {
			$http.get('admin/api-admin-menu/items', { params : { 'nodeId' : $scope.moduleId }} ).then(function(response) {
				var data = response.data;
				for (var itm in data.groups) {
					var grp = data.groups[itm];				
					$scope.itemAdd(grp.name, grp.items);
				}
				$scope.resolveCurrentItem();
			})
		};
		
		$scope.$on('topMenuClick', function(e) {
			$scope.currentItem = null;
		});
		
		$scope.init();
	});
	
	zaa.controller("DashboardController", function ($scope) {
		$scope.logItemOpen = false;
	});
	
	// LayoutMenuController.js
	
	zaa.filter('lockFilter', function() {
		return function(data, table, pk) {
			var has = false;
			angular.forEach(data, function(value) {
				if (value.lock_table == table && value.lock_pk == pk) {
					has = true;
				}
			});
			
			return has;
        };
	});
	
	zaa.controller("LayoutMenuController", function ($scope, $http, $state, $location, $timeout, $window, $filter, CacheReloadService, LuyaLoading, AdminToastService, AdminClassService) {
	
		$scope.AdminClassService = AdminClassService;
		
		$scope.LuyaLoading = LuyaLoading;
		
		$scope.toastQueue = AdminToastService.queue;
		
		$scope.reload = function() {
			CacheReloadService.reload();
		}
	
		/*
		$scope.sidePanelUserMenu = false;
		
		$scope.sidePanelHelp = false;
		
		$scope.toggleHelpPanel = function() {
			$scope.sidePanelHelp = !$scope.sidePanelHelp;
			$scope.sidePanelUserMenu = false;
		};
		
		$scope.toggleUserPanel = function() {
			$scope.sidePanelUserMenu = !$scope.sidePanelUserMenu;
			$scope.sidePanelHelp = false;
		};
		
	    $scope.userMenuOpen = false;
	    */
	
		$scope.notify = null;
		
		$scope.forceReload = 0;
		
		$scope.showOnlineContainer = false;
		
		$scope.searchDetailClick = function(itemConfig, itemData) {
			if (itemConfig.type == 'custom') {
				$scope.click(itemConfig.menuItem).then(function() {
					if (itemConfig.stateProvider) {
						var params = {};
						angular.forEach(itemConfig.stateProvider.params, function(value, key) {
							params[key] = itemData[value];
						})
						
						$state.go(itemConfig.stateProvider.state, params).then(function() {
							$scope.closeSearchInput();
						})
					} else {
						$scope.closeSearchInput();
					}
				});
				
			} else {
				$scope.click(itemConfig.menuItem.module).then(function() {
					var res = itemConfig.menuItem.route.split("/");
					$state.go('default.route', { moduleRouteId : res[0], controllerId : res[1], actionId : res[2]}).then(function() {
						if (itemConfig.stateProvider) {
							var params = {};
							angular.forEach(itemConfig.stateProvider.params, function(value, key) {
								params[key] = itemData[value];
							})
							$state.go(itemConfig.stateProvider.state, params).then(function() {
								$scope.closeSearchInput();
							})
						} else {
							$scope.closeSearchInput();
						}
					})
				});
			}
		};
		
		$scope.visibleAdminReloadDialog = false;
		
		(function tick(){
			$http.get('admin/api-admin-timestamp', { ignoreLoadingBar: true }).then(function(response) {
				$scope.forceReload = response.data.forceReload;
				if ($scope.forceReload && !$scope.visibleAdminReloadDialog) {
					$scope.visibleAdminReloadDialog = true;
					AdminToastService.confirm(i18n['js_admin_reload'], 'Seite neu laden', function($timeout, $toast) {
						$scope.reload();
						$scope.visibleAdminReloadDialog = false;
					});
				}
				
				$scope.locked = response.data.locked;
				$scope.notify = response.data.useronline;
				$timeout(tick, 20000);
			})
		})();
		
		$scope.isLocked = function(table, pk) {
			return $filter('lockFilter')($scope.locked, table, pk);
		}
		
		$scope.searchQuery = null;
	
	    $scope.searchInputOpen = false;
	
	    $scope.escapeSearchInput = function() {
	        if ($scope.searchInputOpen) {
	            $scope.closeSearchInput();
	        }
	    };
	
	    $scope.toggleSearchInput = function() {
	    	$scope.searchInputOpen = !$scope.searchInputOpen;
	    };
	    
	    $scope.openSearchInput = function() {
	        $scope.searchInputOpen = true;
	    };
	
	    $scope.closeSearchInput = function() {
	        $scope.searchInputOpen = false;
	    };
		
		$scope.searchResponse = null;
		
		$scope.searchPromise = null;
	
		$scope.$watch(function() { return $scope.searchQuery}, function(n, o) {
			if (n !== o) {
				if (n.length > 2) {
					$timeout.cancel($scope.searchPromise);
					$scope.searchPromise = $timeout(function() {
						$http.get('admin/api-admin-search', { params : { query : n}}).then(function(response) {
							$scope.searchResponse = response.data;
						});
					}, 400)
				} else {
	                $scope.searchResponse = null;
				}
			}
		});
		
		$scope.items = [];
		
		$scope.currentItem = {};
		
		$scope.click = function(menuItem) {
			$scope.mobileOpen = false;
			$scope.$broadcast('topMenuClick', { menuItem : menuItem });
			if (menuItem.template) {
				return $state.go('custom', { 'templateId' : menuItem.template });
			} else {
				return $state.go('default', { 'moduleId' : menuItem.id});
			}
		};
		
		$scope.isActive = function(item) {
			if (item.template) {
				if ($state.params.templateId == item.template) {
					$scope.currentItem = item;
					return true;
				}
			} else {
				if ($state.params.moduleId == item.id) {
					$scope.currentItem = item;
					return true;
				}
			}
		};
		
		$scope.get = function () {
			$http.get('admin/api-admin-menu').then(function(response) {
				$scope.items = response.data;
			});
		};
		
		$scope.get();
	});
	
	zaa.controller("AccountController", function($scope, $http, $window, AdminToastService) {
		$scope.changePassword = function(pass) {
			$http.post('admin/api-admin-user/change-password', pass).then(function(response) {
				AdminToastService.success(i18n['aws_changepassword_succes'], 5000);
			}, function(error) {
				AdminToastService.errorArray(error.data, 3000);
			});
		};
		
		$scope.updateUserProfile = function(profile) {
			$http.post('admin/api-admin-common/change-language', {lang: profile.lang }).then(function(response) {
				$window.location.reload();
			});
		};
		
		$scope.profile = {}
		
		$scope.getProfile = function() {
			$http.get('admin/api-admin-user/session').then(function(success) {
				$scope.profile = success.data;
			});
		};
		
		$scope.changePersonData = function(data) {
			$http.put('admin/api-admin-user/session-update', data).then(function(success) {
				AdminToastService.success(i18n['js_account_update_profile_success'], 5000);
			}, function(error) {
				AdminToastService.errorArray(error.data, 3000);
			});
		};
		
		$scope.getProfile();
	});
})();