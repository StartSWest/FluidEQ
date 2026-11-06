// Match webpack's asset/source for captions so tests use the actual recording text.
module.exports = {
  process(contents) {
    return { code: `module.exports = ${JSON.stringify(contents)};` };
  },
};
