const makeFilterConditionModule = require('./makeFilterCondition');
const $check = require('check-types');
const $json = require('@synatic/json-magic');
const makeAggregatePipelineModule = require('./makeAggregatePipeline');

exports.makeJoinForPipeline = makeJoinForPipeline;

/**
 * Creates the pipeline components for a join
 *
 * @param {import('../types').AST} ast - the ast that contains the join
 * @returns {*[]}
 */
function makeJoinForPipeline(ast) {
    const pipeline = [];

    for (let i = 1; i < ast.from.length; i++) {
        makeJoinPart(ast.from[i], ast.from[i - 1], pipeline);
    }

    return pipeline;
}

/**
 *
 *
 * @param {import('../types').TableDefinition} join
 * @param {import('../types').TableDefinition} previousJoin,
 * @param {import('../types'.PipelineFn[])} pipeline
 */
function makeJoinPart(join, previousJoin, pipeline) {
    let toTable = join.table || '';
    const toAs = join.as;

    let joinHint = null;
    if (toTable.toLowerCase().endsWith('|first')) {
        joinHint = 'first';
        toTable = toTable.substring(0, toTable.length - 6);
    } else if (toTable.toLowerCase().endsWith('|last')) {
        joinHint = 'last';
        toTable = toTable.substring(0, toTable.length - 5);
    } else if (toTable.toLowerCase().endsWith('|unwind')) {
        joinHint = 'unwind';
        toTable = toTable.substring(0, toTable.length - 7);
    }

    if (
        join.table &&
        join.on &&
        join.on.type === 'binary_expr' &&
        join.on.operator === '='
    ) {
        let localPart;
        let fromPart;
        if (join.on.left.table === toAs || join.on.left.table === toTable) {
            localPart = join.on.right;
            fromPart = join.on.left;
        } else if (
            join.on.right.table === toAs ||
            join.on.right.table === toTable
        ) {
            localPart = join.on.left;
            fromPart = join.on.right;
            // eslint-disable-next-line sonarjs/no-duplicated-branches
        } else {
            localPart = join.on.right;
            fromPart = join.on.left;
        }
        const localField = localPart.table
            ? `${localPart.table}.${localPart.column}`
            : `${previousJoin.as || previousJoin.table}.${localPart.column}`;
        const foreignField = fromPart.column;
        pipeline.push({
            $lookup: {
                from: toTable,
                as: toAs || toTable,
                localField: localField,
                foreignField: foreignField,
            },
        });
        if (joinHint) {
            if (joinHint === 'first') {
                pipeline.push({
                    $set: {
                        [toAs || toTable]: {$first: `$${toAs || toTable}`},
                    },
                });
            } else if (joinHint === 'last') {
                pipeline.push({
                    $set: {
                        [toAs || toTable]: {$last: `$${toAs || toTable}`},
                    },
                });
            } else if (joinHint === 'unwind') {
                pipeline.push({
                    $unwind: {
                        path: `$${toAs || toTable}`,
                        preserveNullAndEmptyArrays: true,
                    },
                });
            }
        }
        if (join.join === 'INNER JOIN') {
            if (joinHint) {
                pipeline.push({$match: {[toAs || toTable]: {$ne: null}}});
            } else {
                pipeline.push({
                    $match: {
                        $expr: {$gt: [{$size: `$${toAs || toTable}`}, 0]},
                    },
                });
            }
        } else if (join.join === 'LEFT JOIN') {
            // dont need anything
        } else {
            throw new Error(`Join not supported:${join.join}`);
        }
    } else {
        const joinQuery = makeFilterConditionModule.makeFilterCondition(
            join.on,
            false,
            true
        );
        const inputVars = {};
        const replacePaths = [];
        $json.walk(joinQuery, (val, path) => {
            if ($check.string(val) && val.startsWith('$$')) {
                const varName = val.substring(2).replace(/[.-]/g, '_');
                inputVars[varName] = `$${val.substring(2)}`;
                replacePaths.push({path: path, newVal: `$$${varName}`});
            }
        });
        for (const path of replacePaths) {
            $json.set(joinQuery, path.path, path.newVal);
        }

        let lookupPipeline = [];

        if (join.expr && join.expr.ast) {
            lookupPipeline = makeAggregatePipelineModule.makeAggregatePipeline(
                join.expr.ast
            );
        }
        lookupPipeline.push({$match: {$expr: joinQuery}});

        pipeline.push({
            $lookup: {
                from: toTable,
                as: toAs,
                let: inputVars,
                pipeline: lookupPipeline,
            },
        });
        if (joinHint) {
            if (joinHint === 'first') {
                pipeline.push({
                    $set: {
                        [toAs || toTable]: {$first: `$${toAs || toTable}`},
                    },
                });
            } else if (joinHint === 'last') {
                pipeline.push({
                    $set: {
                        [toAs || toTable]: {$last: `$${toAs || toTable}`},
                    },
                });
            } else if (joinHint === 'unwind') {
                pipeline.push({
                    $unwind: {
                        path: `$${toAs || toTable}`,
                        preserveNullAndEmptyArrays: true,
                    },
                });
            }
        }
        if (join.join === 'INNER JOIN') {
            if (joinHint) {
                pipeline.push({$match: {[toAs || toTable]: {$ne: null}}});
            } else {
                pipeline.push({
                    $match: {
                        $expr: {$gt: [{$size: `$${toAs || toTable}`}, 0]},
                    },
                });
            }
        } else if (join.join === 'LEFT JOIN') {
            // dont need anything
        } else {
            throw new Error(`Join not supported:${join.join}`);
        }
    }
}