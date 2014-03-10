using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace TgdDurandal.Controllers
{
    [NoCache]
    public class HomeController : Controller
    {
        public ActionResult Index()
        {
            return View();
        }
    }

    public class NoCacheAttribute : ActionFilterAttribute
    {
        public override void OnResultExecuted(ResultExecutedContext filterContext)
        {
            base.OnResultExecuted(filterContext);
            filterContext.RequestContext.HttpContext.Response.Expires = -1;
            filterContext.RequestContext.HttpContext.Response.Cache.SetNoStore();
            filterContext.RequestContext.HttpContext.Response.AppendHeader("Pragma", "no-cache");
            filterContext.RequestContext.HttpContext.Response.Cache.SetRevalidation(HttpCacheRevalidation.AllCaches);
        }
    }
}
