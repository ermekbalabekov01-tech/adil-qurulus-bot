const { handleConstruction } = require('./modules/construction/scenario');
// если клинику пока не трогаем, её можно не подключать
// const { handleClinic } = require('./modules/clinic/scenario');

function detectProject(text = '') {
  const t = String(text).toLowerCase();

  // пока по умолчанию всё ведём в стройку
  return 'construction';
}

function routeMessage({ text, session, projectType }) {
  let project = projectType || session?.project;

  if (!project) {
    project = detectProject(text);
  }

  if (project === 'construction') {
    return {
      project,
      result: handleConstruction(text, session || {})
    };
  }

  return {
    project: 'construction',
    result: handleConstruction(text, session || {})
  };
}

module.exports = { routeMessage };