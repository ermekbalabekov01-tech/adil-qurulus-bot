const { handleClinic } = require('./modules/clinic/scenario');
const { handleConstruction } = require('./modules/construction/scenario');

function routeMessage({ text, from, session = {}, projectType = null }) {

  // если уже определили проект
  if (projectType === 'clinic') {
    return {
      project: 'clinic',
      result: handleClinic(text, session),
    };
  }

  if (projectType === 'construction') {
    return {
      project: 'construction',
      result: handleConstruction(text, session),
    };
  }

  // пока всё отправляем в стройку
  return {
    project: 'construction',
    result: handleConstruction(text, session),
  };
}

module.exports = { routeMessage };