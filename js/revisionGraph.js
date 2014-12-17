;(function($, undefined) {
    $.fn.revisionGraph = function(option) {
        var revisionGraph = null;
 
        var option = $.extend({
 			data 				: [],
            holder   			: $('table'),
            xStep				: 15,	// コミットの系の間隔
			xInitOffset    		: 15,	// 初期のX座標のずれ
			firstRowPadding     : 35,	// コミットツリーの右側のセルのpadding
   		 	circleInrowOffset  	: 3,
    		circleSize         	: 10,
    		circleInnerSize   	: 4,
    		callback			: null
        }, option);
 
        function createGraph($element) {
			if(option.data){
				data = editData(option.data);
				drawRevisionGraph(
					$element.get(0),
					option.data,
		        	option.data.graphSpace
				);
				if(option.callback) option.callback();
			}
        }
 
        function createHashFromArray(array, key){
			var hash = {};
			$.each(array, function(){
				hash[this[key]] = this;
			});
			return hash;
		}
 
        function editData(data){
			var commits     = data.resultMap.commitResults;
			var commitsHash = createHashFromArray(commits, 'hash');	// key = hash, value = commit
			var lines       = [];	// 列ごとにコミットを格納する配列。中身はコミットオブジェクトの配列になる。
			var nums        = [];
			var lineNum     = 0;	// コミットオブジェクトのラインのナンバー。初期は0
			var maxSpace    = 0;
 
			var incrementLineNum = function(){
				if(lines[lineNum]) lineNum++;
			};
 
			/*
			 * 子コミットがターゲット内にあるか調べる
			 */
			var hasChild = function(hash){
				for(var i in commits){
					for(var j in commits[i].parents){
						if(commits[i].parents[j] == hash){
							return true;
						}
					}
				}
				return false;
			}
 
			/*
			 * コミット管理に範囲外の親コミットを追加する
			 */
			var addHiddenParents = function(commitHash, parents){
				for(var i in parents){
					var parentCommitHash = parents[i];	// コミットオブジェクトのhash
					if(!commitsHash[parentCommitHash]){
						var newCommit = {
			                hash			: parents[i],
			                parents			: [],
			                parentsCount	: 0,
			                children		: [commitHash],
			                childrenCount	: 1,
			                shortHash		: null,
			                hiddenParent	: true
			            }
						commits.push(newCommit);
						commitsHash[parentCommitHash] = newCommit;
					}
				}
			}
 
			/*
			 * コミット管理に範囲外の子コミットを追加する
			 */
			var addHiddenChildren = function(commitHash, children){
				for(var i in children){
					var childrenCommitHash = children[i];	// コミットオブジェクトのhash
					if(!commitsHash[childrenCommitHash]){
						var newCommit = {
			                hash			: children[i],
			                parents			: [commitHash],
			                parentsCount	: 1,
			                children		: [],
			                childrenCount	: 0,
			                shortHash		: null,
			                hiddenChild		: true
			            }
						commits.push(newCommit);
						commitsHash[childrenCommitHash] = newCommit;
					} else if(commitsHash[childrenCommitHash].hiddenChild){
						commitsHash[childrenCommitHash].parents.push(commitHash);
					}
				}
			}
 
			/* コミットの親をたどっていき、ひとつのラインごとに系にコミットを格納し、コミットに列ナンバーをもたせる。
			 * commitHash string コミットオブジェクトのhash
			 * parents    Array  親コミットオブジェクトのhash配列
			 */
			var findAndPushParent = function(commitHash, parents){
				// spaceに系の番号をいれる
				commitsHash[commitHash].space  = lineNum;
				commitsHash[commitHash].system = lineNum;
 
				// 親がない場合はこの系は終了
				if(parents.length == 0){
					lines[lineNum].endCommit = commitHash;
					incrementLineNum();
					return;
				}
 
				if(lineNum > 0 && parents.length > 1){
					parents = analyzeParents(parents);
				}
 
				function analyzeParents(parents){
					var hash        = [];
					var result      = [];
 
					for(var i in parents){
						var hasEndParent = false;
 
						if(checkParentExists(parents[i])){
							hasEndParent = true;
						}
 
						hash[i] = {
									hash		: parents[i],
									commitNum	: commitsHash[parents[i]].commitNum,
									hasEndParent: hasEndParent
								}
					}
					hash.sort(function(a, b){
						if((a.hasEndParent && !b.hasEndParent)
							|| (((a.hasEndParent && b.hasEndParent) || (!a.hasEndParent && !b.hasEndParent)) && a.commitNum < b.commitNum)) return -1;
						if((!a.hasEndParent && b.hasEndParent)
							|| (((a.hasEndParent && b.hasEndParent) || (!a.hasEndParent && !b.hasEndParent)) && a.commitNum > b.commitNum)) return 1;
						return 0;
					});
					for(var i in hash){
						result.push(hash[i].hash);
					}
					return result;
				}
 
				function checkParentExists(commit){
					var parentExists = false;
					for(var j in lines){
						for(var k in lines[j].commits){
							if(commit == lines[j].commits[k]){
								return true;
							}
						}
					}
					return false;
				}
 
				for(var i in parents){
					var parentCommitHash = parents[i];	// コミットオブジェクトのhash
 
					// 親コミットがターゲット範囲の中にあった場合
					if(commitsHash[parentCommitHash]){
						// 親がすでに別の系にはいっている場合、系は完了
						var parentExists = false;
						for(var j in lines){
							for(var k in lines[j].commits){
								if(parentCommitHash == lines[j].commits[k]){
									parentExists = true;
									break;
								}
							}
						}
						// lineごとにコミットを格納する配列にいれる
						if(!lines[lineNum]){
							lines[lineNum] = {commits: [], startCommit: null, endCommit: null };
							lines[lineNum].startCommit = commitHash;
							if(commitsHash[commitHash].hiddenChild && commitsHash[commitHash].space > 1){
								lines[lineNum].commits.push(commitHash);
							}
						}
						// 親コミットがすでに別のlineに存在する場合はこのlineは終了
						if(parentExists){
							lines[lineNum].endCommit = parentCommitHash;
							incrementLineNum();
						}else{
							lines[lineNum].commits.push(parentCommitHash);
							commitsHash[parentCommitHash].space  = commitsHash[commitHash].space;
							commitsHash[parentCommitHash].system = commitsHash[commitHash].system;
							// そのさらに親について処理する
							findAndPushParent(parentCommitHash, commitsHash[parentCommitHash].parents);
						}
					} else {
						lines[lineNum].endCommit = parentCommitHash;
						incrementLineNum();
					}
				}
			};
			// 一度全コミットをさらってターゲット内にない子コミットを管理に追加
			$.each(commits.reverse(), function(i){
				addHiddenChildren(commits[i].hash, commits[i].children);
			});
 
			commits.reverse();
 
			// 一度全コミットをさらってターゲット内にない親コミットを管理に追加
			$.each(commits, function(i){
				addHiddenParents(commits[i].hash, commits[i].parents);
			});
 
			// コミットがそろった状態で全コミットをさらってインデックスを追加
			$.each(commits, function(i){
				commitsHash[this.hash].commitNum = i;
			});
 
			// 全コミットに対してX位置を指定する
			$.each(commits, function(i){
				// X軸が決まっていなくて親コミットまたは子コミットがある場合
				if(commitsHash[commits[i].hash].space == undefined
					&& !(commits[i].parentsCount == 0 && commits[i].childrenCount == 0)){
					findAndPushParent(commits[i].hash, commits[i].parents);
				}
			});
 
			// 各lineの幅を求める
			for(var i in lines){
				nums[i] = {
							min: commitsHash[lines[i].startCommit].commitNum,
							max: lines[i].endCommit ?　commitsHash[lines[i].endCommit].commitNum : option.data.resultMap.commitResults.size
						};
			}
 
			// 重なるlineがなければspaceをひとつつめる
			for(var i in lines){
				if(i < 2) continue;
				var pastNum     = i - 1;
				var insideLines = [];
				var resultSpace = 0;
				for(var j in lines){
					if((nums[pastNum] && nums[i].min != null && nums[i].max != null && nums[pastNum].min != null && nums[pastNum].max != null)
						&& (
							(nums[pastNum].min <= nums[i].min && nums[pastNum].max <= nums[i].max)
								|| (nums[pastNum].min < nums[i].min && nums[pastNum].max > nums[i].min)
								|| (nums[pastNum].min < nums[i].max && nums[pastNum].max > nums[i].max)
								|| (nums[pastNum].min >= nums[i].min && nums[pastNum].max <= nums[i].max)
							)
						&& lines[pastNum].commits.length > 0
						){
							insideLines.push(commitsHash[lines[pastNum].commits[0]].space);
					}
					pastNum--;
					if(pastNum < 0) break;
				}
				resultSpace = insideLines.length == 0 ? 2 : (Math.max.apply(null, insideLines) + 1);
 
				if(lines[i].commits.length == 0 && !hasChild(lines[i].startCommit)){
					commitsHash[lines[i].startCommit].space = resultSpace;
				} else {
					for(var k in lines[i].commits){
						commitsHash[lines[i].commits[k]].space = resultSpace;
					}
				}
			}
 
			$.each(commitsHash, function(){
				if(maxSpace < this.space){
					maxSpace = this.space;
				}
			});
			data.resultMap.commitResults = $.map(commitsHash, function(val,i){return val;}).reverse();
			data.graphSpace  = maxSpace;
			data.graphSystem = lineNum;
			return data;
		}
 
		// 実際にグラフを書く
		function drawRevisionGraph(holder, data, graph_space) {
		    var commits             = data.resultMap.commitResults;
		    var maxCommitNum        = commits.length - 1;
		    var $commitTableRows    = option.holder.children('*');
 
			$commitTableRows.find('td:nth-child(1)').css({paddingLeft: (graph_space + 2) * option.xStep + option.firstRowPadding});
 
		    // create graph
		    if(revisionGraph != null)
		        revisionGraph.clear();
		    else
		        revisionGraph = Raphael(holder);
 
		    var top = revisionGraph.set();
		    // init dimensions
		    var graphXOffset = $commitTableRows.first().find('td').first().position().left - $(holder).position().left + option.xInitOffset,
		        graphYOffset = $(holder).position().top,
		        graph_right_side = graphXOffset + (graph_space + 2) * option.xStep,
		        graph_bottom = $commitTableRows.last().position().top + $commitTableRows.last().height() - graphYOffset;
 
		    revisionGraph.setSize(graph_right_side, graph_bottom);
 
		    // init colors
		    var colors = [];
		    Raphael.getColor.reset();
		    for (var k = 0; k <= data.graphSystem; k++) {
		        colors.push(Raphael.getColor(0.80));
		    }
 
		    var parentCommit;
		    var x, y, parentX, parentY;
		    var path, title;
		    var revision_dot_overlay;
		    $.each(commits, function(index, commit) {
		        if (!commit.hasOwnProperty('space')){
		        	commit.space = 0;
		        	commit.system = 0;
		        }
				var targetNum = maxCommitNum - index > $commitTableRows.size() - 1 ? $commitTableRows.size() - 1 : maxCommitNum - index;
		        var $targetRow = $commitTableRows.eq(targetNum);
		        var basicY = $targetRow.position().top - graphYOffset + option.circleInrowOffset + ($targetRow.height() - option.circleSize)/ 2;
 
		        if(commit.hiddenParent){
		        	y = basicY * 2;
		        } else if(commit.hiddenChild){
		        	y = -basicY;
		        } else {
		        	y = basicY;
		        }
		        x = graphXOffset + option.xStep / 2 + option.xStep * commit.space;
 
 
				// コミットの円　ターゲットにないフラグがついていたら無視
				if(!commit.hiddenParent && !commit.hiddenChild){
					revisionGraph.circle(x, y, option.circleSize)
		            .attr({
		                fill: colors[commit.system],
		                stroke: 'none',
		            }).toFront();
		        	revisionGraph.circle(x, y, option.circleInnerSize)
		            .attr({
		                fill: '#f7f7f7',
		                stroke: 'none',
		            }).toFront();
				}
 
		        // paths to parents
		        $.each(commit.parents, function(indexParents, parentScmid) {
		        	$.each(commits, function(indexParent, commit) {
		        		if(commit.hash === parentScmid){
		        			parentCommit = commit;
		        			parentCommitIndex = indexParent;
		        			return;
		        		}
		        	});
		            if (parentCommit) {
		                if (!parentCommit.hasOwnProperty("space")){
		                	parentCommit.space  = indexParents;
		                	parentCommit.system = indexParents;
		                }
		                var targetNum = maxCommitNum - parentCommitIndex > $commitTableRows.size() - 1 ? $commitTableRows.size() - 1 : maxCommitNum - parentCommitIndex;
		                var $targetRow = $commitTableRows.eq(targetNum);
						var basicY = $targetRow.position().top - graphYOffset + option.circleInrowOffset + ($targetRow.height() - option.circleSize) / 2;
						color = parentCommit.space > commit.space ? colors[parentCommit.system] : colors[commit.system];
		                if(parentCommit.hiddenParent){
				        	parentY = basicY * 2;
				        } else if(parentCommit.hiddenChild){
				        	parentY = -basicY;
				        } else {
				        	parentY = basicY;
				        }
				        //parentY = parentCommit.hiddenParent ? basicY * 2 : basicY;
		                parentX = graphXOffset + option.xStep / 2 + option.xStep * parentCommit.space;
		                if (parentCommit.space == commit.space) {
		                    // vertical path
		                    path = revisionGraph.path([
		                        'M', x, y,
		                        'V', parentY])
		                        .attr({stroke: color, "stroke-width": 2}).toBack();
		                } else {
		                    // 曲線
		                    if(parentCommit.space < commit.space){
		                    	// 親の位置が子供の位置より左のとき
		                    	path = revisionGraph.path([
		                        'M', x, y,
		                        'L', x, parentY - 25,
		                        'C', x, parentY - 25, x + 1, parentY - 20, x - 5, parentY - 15,
		                        'L', parentX, parentY])
								.attr({stroke: color, "stroke-width": 2}).toBack();
		                    }else{
		                    	// 親の位置が子供の位置より右のとき
		                    	path = revisionGraph.path([
		                        'M', x, y,
		                        'L', parentX - 5, y + 15,
		                        'C', parentX - 5, y + 15, parentX + 1, y + 20, parentX, y + 25,
		                        'L', parentX, parentY])
								.attr({stroke: color, "stroke-width": 2}).toBack();
		                    }
		                }
		            } else {
		                // vertical path ending at the bottom of the revisionGraph
		                path = revisionGraph.path([
		                    'M', x, y,
		                    'V', graph_bottom]).attr({stroke: colors[commit.system], "stroke-width": 2}).toBack();
		            }
		        });
		        revision_dot_overlay = revisionGraph.circle(x, y, 10);
		        revision_dot_overlay
		            .attr({
		                fill: '#000',
		                opacity: 0,
		                cursor: 'pointer',
		                href: commit.hash
		            });
		            title = document.createElementNS(revisionGraph.canvas.namespaceURI, 'title');
		            title.appendChild(document.createTextNode(commit.hash));
		            revision_dot_overlay.node.appendChild(title);
		        top.push(revision_dot_overlay);
		    });
		    top.toFront();
		}
        this.each(function() {
        	if(option.holder.children('*').length == 0) return;
        	var $self = $(this);
        	$self.css(
        		{
        			position: 'absolute',
        			top: option.holder.children('*').position().top,
        			height: option.holder.height(),
        			minWidth: '1px'
        		}
        	);
        	createGraph($self);
        });
        return this;
    };
})(jQuery);