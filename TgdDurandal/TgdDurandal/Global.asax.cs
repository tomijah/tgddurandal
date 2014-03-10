namespace TgdDurandal
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Web;
    using System.Web.Http;
    using System.Web.Mvc;
    using System.Web.Optimization;
    using System.Web.Routing;

    public class MvcApplication : System.Web.HttpApplication
    {
        protected void Application_Start()
        {
            AreaRegistration.RegisterAllAreas();

            WebApiConfig.Register(GlobalConfiguration.Configuration);
            FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
            RouteConfig.RegisterRoutes(RouteTable.Routes);
            var bundles = BundleTable.Bundles;
            bundles.Add(
                new ScriptBundle("~/Scripts/lib").Include("~/Scripts/jquery-{version}.js")
                                                    .Include("~/Scripts/bootstrap.js")
                                                    .Include("~/Scripts/knockout-{version}.js")
                                                    .Include("~/Scripts/knockout.validation.js")
                                                    .Include("~/Scripts/knockout.activity.js")
                                                    .Include("~/Scripts/lodash.js"));

            bundles.Add(
                new StyleBundle("~/Content/css").Include("~/Content/bootstrap.min.css")
                                                .Include("~/Content/durandal.css")
                                                .Include("~/Content/site.css"));

        }
    }
}